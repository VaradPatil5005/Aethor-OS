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

  const unreadCount = threads.filter((t) => t.messages.length === 0).length;

  return (
    <div className="h-full w-full flex min-h-0 bg-white font-pixel text-[13px]">
      {/* Thread list */}
      <aside className="w-60 shrink-0 flex flex-col min-h-0 border-r-2 border-black bg-white">
        <div className="shrink-0 px-3 py-1.5 border-b-2 border-black bg-[var(--rt-side)] font-terminal text-[16px] uppercase tracking-wide">
          {threads.length} conversations{unreadCount ? `, ${unreadCount} new` : ''}
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          {threads.map((thread) => {
            const done = Boolean(thread.script?.length) && thread.script!.length <= thread.stepIndex;
            const active = activeThreadId === thread.id;
            return (
              <button
                key={thread.id}
                onClick={() => { retroAudio.playClickSound(); setActiveThreadId(thread.id); }}
                className={`w-full text-left px-3 py-2.5 flex items-center gap-3 border-b border-black/15 ${active ? 'bg-black text-white' : 'hover:bg-[#e6e6e6]'}`}
                aria-current={active ? 'true' : undefined}
              >
                <span className="w-10 h-10 shrink-0 rounded-full border-2 border-current bg-white flex items-center justify-center text-[22px] leading-none">
                  {thread.avatar}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="flex items-center justify-between gap-1">
                    <span className="font-terminal text-[20px] leading-none truncate">{thread.name}</span>
                    {done && <span className="font-terminal text-[16px]">done</span>}
                  </span>
                  <span className={`block truncate font-terminal text-[16px] leading-tight ${active ? 'text-[#d0d0d0]' : 'text-[var(--rt-muted)]'}`}>
                    {thread.preview || thread.role}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Conversation */}
      <section className="flex-1 min-w-0 min-h-0 flex flex-col">
        <header className="shrink-0 px-3 py-2 border-b-2 border-black flex items-center justify-between gap-2 bg-white">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-9 h-9 shrink-0 rounded-full border-2 border-black flex items-center justify-center text-[20px]">{activeThread.avatar}</span>
            <div className="min-w-0">
              <div className="font-terminal text-[20px] leading-none truncate">{activeThread.name}</div>
              <div className="font-terminal text-[15px] leading-tight text-[var(--rt-muted)] truncate">{activeThread.role}</div>
            </div>
          </div>
          {isScripted && (
            <button onClick={() => handleRestartChat(activeThread.id)} className="rt-btn rt-btn-sm" title="Restart this conversation">
              <RotateCcw className="w-3.5 h-3.5" /> Restart
            </button>
          )}
        </header>

        <div ref={chatContainerRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3 bg-[var(--rt-soft)]">
          {activeThread.messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center gap-1 p-6">
              <span className="w-14 h-14 rounded-full border-2 border-black bg-white flex items-center justify-center text-[30px]">{activeThread.avatar}</span>
              <p className="font-bold mt-1">{activeThread.name}</p>
              <p className="font-terminal text-[18px] leading-tight text-[var(--rt-muted)] max-w-xs">No messages yet. Tap the suggestion below to start.</p>
            </div>
          )}

          {activeThread.messages.map((msg, i) => {
            const me = msg.sender === 'me';
            return (
              <div key={i} className={`flex flex-col ${me ? 'items-end' : 'items-start'}`}>
                <div
                  className={`max-w-[80%] px-3 py-1.5 border-2 border-black rounded-[14px] font-terminal text-[19px] leading-snug select-text ${
                    me ? 'bg-black text-white rounded-br-[3px]' : 'bg-white text-black rounded-bl-[3px] shadow-[3px_3px_0_rgba(0,0,0,0.9)]'
                  }`}
                >
                  {msg.text}
                </div>
                <span className="font-terminal text-[14px] text-[var(--rt-muted)] mt-0.5 px-1">{msg.time}</span>
              </div>
            );
          })}

          {isTyping && (
            <div className="flex items-start">
              <div className="px-3 py-1.5 border-2 border-black rounded-[14px] rounded-bl-[3px] bg-white flex items-center gap-2 font-terminal text-[17px]" aria-live="polite">
                {activeThread.name} is typing
                <span className="inline-flex gap-1">
                  {[0, 1, 2].map((d) => (
                    <span key={d} className="w-1.5 h-1.5 bg-black animate-bounce" style={{ animationDelay: `${d * 0.15 - 0.3}s` }} />
                  ))}
                </span>
              </div>
            </div>
          )}
        </div>

        {isScripted && currentStep && !isTyping && (
          <div className="shrink-0 px-3 pt-2 border-t-2 border-black bg-white">
            <div className="font-terminal text-[15px] uppercase tracking-wide text-[var(--rt-muted)] flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> Suggested reply · step {activeThread.stepIndex + 1} of {currentScript?.length}
            </div>
            <button
              onClick={() => handlePostMessage(currentStep.userTemplate)}
              className="my-1.5 max-w-full px-3 py-1 border-[3px] border-black rounded-[19px] bg-white shadow-[3px_3px_0_rgba(0,0,0,0.9)] font-terminal text-[18px] leading-tight text-left hover:bg-black hover:text-white active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
            >
              {currentStep.userTemplate}
            </button>
          </div>
        )}

        {isCompleted && (
          <div className="shrink-0 px-3 py-2 border-t-2 border-black bg-[#dcf7d9] flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 font-bold"><CheckCircle2 className="w-4 h-4 shrink-0" /> Conversation complete</span>
            <button onClick={() => handleRestartChat(activeThread.id)} className="rt-btn rt-btn-sm">Restart</button>
          </div>
        )}

        <form
          onSubmit={(e) => { e.preventDefault(); handlePostMessage(inputText); }}
          className="shrink-0 p-2 border-t-2 border-black flex items-center gap-2 bg-[var(--rt-side)]"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={isTyping ? 'Reply incoming…' : isCompleted ? 'Type a message or restart…' : 'Type a message…'}
            aria-label="Message"
            disabled={isTyping}
            className="flex-1 min-w-0 px-3 py-1 rounded-[19px] font-terminal text-[18px] disabled:bg-[#ececec]"
          />
          <button type="submit" disabled={isTyping || !inputText.trim()} className="rt-btn rt-btn-sm">
            <Send className="w-3.5 h-3.5" /> Send
          </button>
        </form>
      </section>
    </div>
  );
};
