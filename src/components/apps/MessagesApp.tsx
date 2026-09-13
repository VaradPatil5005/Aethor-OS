import React, { useState, useRef, useEffect } from 'react';
import { retroAudio } from '../../utils/audio';
import { Send, Sparkles, RotateCcw, CheckCircle2 } from 'lucide-react';

interface Message {
  sender: 'them' | 'me';
  text: string;
  time: string;
}

interface ScriptStep {
  userTemplate: string;
  replies: string[];
}

interface Thread {
  id: string;
  name: string;
  role: string;
  avatar: string;
  preview: string;
  messages: Message[];
  script?: ScriptStep[];
  stepIndex: number;
}

export const MessagesApp: React.FC = () => {
  const [activeThreadId, setActiveThreadId] = useState<string>('maam');
  const [inputText, setInputText] = useState<string>('');
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  const initialThreads: Thread[] = [
    {
      id: 'maam',
      name: "OS Ma'am",
      role: "Project Guide & Professor",
      avatar: "👩‍🏫",
      preview: "Good evening! I’m good, how about you?",
      stepIndex: 0,
      messages: [],
      script: [
        {
          userTemplate: "Good evening ma’am! How are you?",
          replies: ["Good evening! I’m good, how about you?"]
        },
        {
          userTemplate: "I’m good too ma’am, just tired with all the classes 😂",
          replies: ["Haha, understandable 😂", "Anyway, what about your project?"]
        },
        {
          userTemplate: "Umm… my project ma’am? 😭",
          replies: ["Yes 😂 How much have you completed?"]
        },
        {
          userTemplate: "Actually ma’am… it’s going on 😭",
          replies: ["What have you done so far?"]
        },
        {
          userTemplate: "I’ve done the basic research and started the implementation… but it’s not fully working yet 😭",
          replies: ["Okay, make sure you complete it soon."]
        },
        {
          userTemplate: "Yes ma’am 😭 I’ll definitely complete it.",
          replies: ["Good. Show me a working demo with all test cases in the next lab session! All the best 👍"]
        }
      ]
    },
    {
      id: 'baba',
      name: "Baba",
      role: "Father 🏡 Pune",
      avatar: "👨‍🦳",
      preview: "Bar zhal. Jevan kela ka neet?",
      stepIndex: 0,
      messages: [],
      script: [
        {
          userTemplate: "Baba, hostel la pohchlo me!",
          replies: ["Bar zhal. Jevan kela ka neet?"]
        },
        {
          userTemplate: "Ho baba, mess madhe jevan kela. Tumhi kase aahat?",
          replies: ["Me mast aahe. Tu abhyas kiti zhalay te sang, project cha kay chalu aahe?"]
        },
        {
          userTemplate: "Project cha coding chalu aahe baba, Operating System banavtoy!",
          replies: ["Arre waah! Khup chhan. Raatra bhar jop nahi ashi nako karu, velavar jhopat ja."]
        },
        {
          userTemplate: "Ho baba nakki. Tumhi aani aai kaalji ghya ❤️",
          replies: ["Ho, paise lagle tar sang mala udya transfer karto. Kaalji ghe! 👍"]
        }
      ]
    },
    {
      id: 'aai',
      name: "Aai",
      role: "Mother ❤️",
      avatar: "🌸",
      preview: "Kahi nahi baala, basleli. Tu kasa aahes?",
      stepIndex: 0,
      messages: [],
      script: [
        {
          userTemplate: "Aai! Kay karteys?",
          replies: ["Kahi nahi baala, basleli. Tu kasa aahes? Awaaj thakleli vattoy!"]
        },
        {
          userTemplate: "Thoda thakloy aai, college madhe continuous lab hoti aani project cha kaam chalu aahe 😭",
          replies: ["Arre baapre! Paani pyalaska divasbhar? Dabba khallas kela ka sakalcha?"]
        },
        {
          userTemplate: "Ho aai sabudan khichdi aavadli khup, sagla khalla!",
          replies: ["Chhan! Jaast load nako gheu project cha, devache aashirwad aahet tuzyavar. Raatri doodh piun jhop!"]
        },
        {
          userTemplate: "Ho aai love you, bye!",
          replies: ["Love you beta, Shubh Ratri! Kalji ghe! 🌸"]
        }
      ]
    },
    {
      id: 'bob',
      name: "Bob (Roommate)",
      role: "Roommate & Lab Partner",
      avatar: "👱‍♂️",
      preview: "Did you run the MLFQ scheduler experiment yet?",
      stepIndex: 0,
      messages: [
        { sender: "them", text: "Hey Varad, rent is due on the 1st.", time: "09:15 AM" },
        { sender: "me", text: "Working on the AetherOS kernel right now, will transfer by evening.", time: "09:18 AM" },
        { sender: "them", text: "Cool! Did you run the MLFQ scheduler experiment yet?", time: "09:20 AM" }
      ]
    },
    {
      id: 'kernel',
      name: "Kernel Daemon",
      role: "System Subsystem",
      avatar: "⚙️",
      preview: "Dual-Core SMP Work-Stealing active.",
      stepIndex: 0,
      messages: [
        { sender: "them", text: "AetherOS Microkernel v3.4.1 initialized.", time: "08:00 AM" },
        { sender: "them", text: "Crash-Consistent VFS: WAL mounted with 0 corruptions.", time: "08:00 AM" },
        { sender: "them", text: "Simulated eBPF: 4 active tracepoints attached.", time: "08:01 AM" }
      ]
    }
  ];

  const [threads, setThreads] = useState<Thread[]>(initialThreads);

  const activeThread = threads.find((t) => t.id === activeThreadId) || threads[0];

  useEffect(() => {
    scrollToBottom();
  }, [activeThread.messages, isTyping, activeThreadId]);

  const handlePostMessage = (textToSend: string) => {
    if (!textToSend.trim() || isTyping) return;

    retroAudio.playClickSound();
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const updatedThreads = threads.map((t) => {
      if (t.id !== activeThreadId) return t;
      return {
        ...t,
        messages: [...t.messages, { sender: 'me' as const, text: textToSend, time: timeStr }]
      };
    });

    setThreads(updatedThreads);
    setInputText('');

    if (activeThread.script) {
      const step = activeThread.script[activeThread.stepIndex];
      if (step) {
        setIsTyping(true);

        const replies = step.replies;
        let delayAccumulator = 900;

        replies.forEach((replyText, idx) => {
          setTimeout(() => {
            retroAudio.playWindowSound();
            const replyTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            setThreads((prevThreads) =>
              prevThreads.map((t) => {
                if (t.id !== activeThreadId) return t;
                const isLast = idx === replies.length - 1;
                return {
                  ...t,
                  stepIndex: isLast ? t.stepIndex + 1 : t.stepIndex,
                  preview: replyText,
                  messages: [
                    ...t.messages,
                    { sender: 'them' as const, text: replyText, time: replyTime }
                  ]
                };
              })
            );

            if (idx === replies.length - 1) {
              setIsTyping(false);
            }
          }, delayAccumulator);

          delayAccumulator += 1100;
        });
      }
    }
  };

  const handleRestartChat = (threadId: string) => {
    retroAudio.playClickSound();
    setIsTyping(false);
    setThreads((prev) =>
      prev.map((t) => {
        if (t.id !== threadId) return t;
        return {
          ...t,
          stepIndex: 0,
          messages: []
        };
      })
    );
  };

  const currentScript = activeThread.script;
  const isScripted = Boolean(currentScript && currentScript.length > 0);
  const currentStep = isScripted && currentScript ? currentScript[activeThread.stepIndex] : null;
  const isCompleted = isScripted && currentScript && activeThread.stepIndex >= currentScript.length;

  return (
    <div className="h-full w-full bg-[#cecece] text-black flex select-none font-pixel overflow-hidden text-xs min-h-0">
      {/* Sidebar Threads List */}
      <div className="w-56 md:w-60 bg-[#dfdfdf] border-r-2 border-[#888] flex flex-col shrink-0 min-h-0">
        <div className="p-2.5 border-b border-[#888] bg-[#cecece] font-bold text-xs flex items-center justify-between shrink-0">
          <span className="flex items-center gap-1.5">
            <span>💬</span>
            <span>Messages</span>
          </span>
          <span className="text-[10px] bg-slate-200 border border-[#999] px-1.5 py-0.5 rounded text-slate-700">
            {threads.length} chats
          </span>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 divide-y divide-[#ccc]">
          {threads.map((thread) => {
            const hasScript = Boolean(thread.script && thread.script.length > 0);
            const isThreadCompleted = hasScript && thread.script && thread.stepIndex >= thread.script.length;

            return (
              <button
                key={thread.id}
                onClick={() => {
                  retroAudio.playClickSound();
                  setActiveThreadId(thread.id);
                }}
                className={`w-full text-left p-2.5 flex items-start gap-2.5 hover:bg-[#b0b8c8] cursor-pointer transition-colors ${
                  activeThreadId === thread.id ? 'bg-[#181a24] text-white' : 'text-black'
                }`}
              >
                <span className="text-2xl shrink-0 drop-shadow-sm">{thread.avatar}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold truncate">{thread.name}</span>
                    {isThreadCompleted && (
                      <span className="text-[9px] text-emerald-400 font-bold">✓</span>
                    )}
                  </div>
                  <div className={`text-[10px] truncate ${activeThreadId === thread.id ? 'text-slate-300' : 'text-slate-600'}`}>
                    {thread.preview || thread.role}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Message Chat View */}
      <div className="flex-1 min-w-0 min-h-0 flex flex-col bg-white overflow-hidden">
        {/* Thread Header */}
        <div className="h-10 px-3 bg-[#cecece] border-b border-[#888] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">{activeThread.avatar}</span>
            <div>
              <div className="text-xs font-bold tracking-wide text-black flex items-center gap-1.5">
                <span>{activeThread.name}</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" title="Online" />
              </div>
              <div className="text-[10px] text-slate-600 leading-none">
                {activeThread.role}
              </div>
            </div>
          </div>

          {isScripted && (
            <button
              onClick={() => handleRestartChat(activeThread.id)}
              className="px-2 py-0.5 bg-[#dedede] hover:bg-slate-200 border border-t-white border-l-white border-r-black border-b-black text-[10px] font-bold flex items-center gap-1 cursor-pointer active:border-t-black active:border-l-black"
              title="Restart conversation from beginning"
            >
              <RotateCcw className="w-3 h-3 text-slate-700" />
              <span>Restart Chat</span>
            </button>
          )}
        </div>

        {/* Message Stream Viewport: strictly scrollable and bounded */}
        <div 
          ref={chatContainerRef}
          className="flex-1 min-h-0 p-3.5 overflow-y-auto space-y-3 bg-[#f3f4f6] overscroll-contain"
        >
          {activeThread.messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500 font-mono text-xs">
              <span className="text-3xl mb-2">{activeThread.avatar}</span>
              <p className="font-bold text-black text-sm mb-1">{activeThread.name}</p>
              <p className="text-[11px] text-slate-600 max-w-xs mb-3">
                No messages sent yet. Post the ready template below to begin!
              </p>
            </div>
          )}

          {activeThread.messages.map((msg, i) => (
            <div
              key={i}
              className={`flex flex-col ${msg.sender === 'me' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[80%] px-3.5 py-2 rounded-lg text-xs shadow-sm leading-relaxed ${
                  msg.sender === 'me'
                    ? 'bg-indigo-600 text-white rounded-br-none border border-indigo-700'
                    : 'bg-white text-black rounded-bl-none border border-slate-300'
                }`}
              >
                {msg.text}
              </div>
              <span className="text-[9px] text-slate-500 mt-1 px-1 font-mono">{msg.time}</span>
            </div>
          ))}

          {/* Realistic Typing Indicator Bubble */}
          {isTyping && (
            <div className="flex flex-col items-start animate-fadeIn">
              <div className="bg-white border border-slate-300 px-3.5 py-2 rounded-lg rounded-bl-none shadow-sm flex items-center gap-1.5">
                <span className="text-[10px] text-slate-600 font-bold">{activeThread.name} is typing</span>
                <span className="inline-flex gap-1 items-center">
                  <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce" />
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Ready-to-Post Interactive Template Strip */}
        {isScripted && currentStep && !isTyping && (
          <div className="px-3 py-2 bg-[#edf2f7] border-t border-[#cbd5e1] flex items-center justify-between gap-2 shrink-0">
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase font-bold text-indigo-800 flex items-center gap-1 mb-0.5">
                <Sparkles className="w-3 h-3 text-amber-600 shrink-0" />
                <span>Ready Template (Step {activeThread.stepIndex + 1} of {currentScript?.length}):</span>
              </div>
              <div className="text-xs text-slate-900 font-medium truncate italic">
                "{currentStep.userTemplate}"
              </div>
            </div>
            <button
              onClick={() => handlePostMessage(currentStep.userTemplate)}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded shadow-sm flex items-center gap-1.5 shrink-0 cursor-pointer active:scale-95 transition"
            >
              <Send className="w-3 h-3" />
              <span>Post This Message</span>
            </button>
          </div>
        )}

        {/* Conversation Completed Banner */}
        {isCompleted && (
          <div className="px-3 py-2 bg-emerald-50 border-t border-emerald-300 flex items-center justify-between text-emerald-900 shrink-0">
            <div className="flex items-center gap-1.5 text-xs font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Conversation completed! All replies received.</span>
            </div>
            <button
              onClick={() => handleRestartChat(activeThread.id)}
              className="px-2.5 py-1 bg-white hover:bg-emerald-100 border border-emerald-400 text-emerald-800 font-bold text-xs rounded cursor-pointer transition"
            >
              Restart Chat ↺
            </button>
          </div>
        )}

        {/* Input Bar */}
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            handlePostMessage(inputText);
          }} 
          className="p-2.5 bg-[#dfdfdf] border-t border-[#888] flex items-center gap-2 shrink-0"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={isTyping ? "Please wait, reply incoming..." : isCompleted ? "Type a custom message or restart..." : "Type or edit message..."}
            disabled={isTyping}
            className="flex-1 px-3 py-1.5 text-xs bg-white border border-[#999] rounded-sm focus:outline-none focus:border-black text-black disabled:bg-slate-100 font-mono"
          />
          <button
            type="submit"
            disabled={isTyping || !inputText.trim()}
            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs border border-black rounded-sm flex items-center gap-1.5 active:translate-y-0.5 cursor-pointer transition"
          >
            <Send className="w-3 h-3" />
            <span>Send</span>
          </button>
        </form>
      </div>
    </div>
  );
};
