import React, { useState, useEffect } from 'react';
import { useWindowStore } from '../../stores/useWindowStore';
import { retroAudio } from '../../utils/audio';

interface CommentItem {
  id: string;
  name: string;
  message: string;
  date: string;
}

const DEFAULT_COMMENTS: CommentItem[] = [
  {
    id: '1',
    name: 'Bacbon',
    message: 'This was great add more things',
    date: 'Aug 19, 2026, 12:22 AM'
  },
  {
    id: '2',
    name: 'Mariya Anjum',
    message: 'Honestly, how I completely feel I\'m actually working on a computer. It has got this amazing nostalgic vibe. Overall I would rate it a 100 on 10. pretty awesome job dude. ...',
    date: 'Aug 19, 2026, 12:14 AM'
  },
  {
    id: '3',
    name: 'Ivan',
    message: 'Love this OS . wonderful experience to visit this. Keep it up ?? All the best',
    date: 'Aug 15, 2026, 04:30 PM'
  },
  {
    id: '4',
    name: 'Soham',
    message: 'Broo this is super sick! Loved the desktop details & microkernel simulation.',
    date: 'Sep 11, 2026, 02:40 PM'
  },
  {
    id: '5',
    name: 'aryan',
    message: 'this thing is so freaking cool',
    date: 'Sep 9, 2026, 05:45 PM'
  }
];

export const CommunityApp: React.FC = () => {
  const { activeUser } = useWindowStore();
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showPostModal, setShowPostModal] = useState<boolean>(false);
  const [postName, setPostName] = useState<string>('');
  const [postMessage, setPostMessage] = useState<string>('');

  useEffect(() => {
    try {
      const stored = localStorage.getItem('aetheros_guestbook_comments');
      if (stored) {
        setComments(JSON.parse(stored));
      } else {
        setComments(DEFAULT_COMMENTS);
      }
    } catch {
      setComments(DEFAULT_COMMENTS);
    }
  }, []);

  const handlePostSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!postName.trim() || !postMessage.trim()) return;

    retroAudio.playClickSound();

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }) + ', ' + now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });

    const newComment: CommentItem = {
      id: Date.now().toString(),
      name: postName.trim(),
      message: postMessage.trim(),
      date: dateStr
    };

    const updated = [newComment, ...comments];
    setComments(updated);
    try {
      localStorage.setItem('aetheros_guestbook_comments', JSON.stringify(updated));
    } catch (err) {
      console.error(err);
    }

    setPostName('');
    setPostMessage('');
    setShowPostModal(false);
  };

  const filteredComments = comments.filter((c) => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.message.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="h-full w-full bg-[#d0d0d0] text-black font-pixel select-none flex flex-col relative overflow-hidden min-h-0 min-w-0">
      {/* Main Two-Column Viewport */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
        
        {/* Left Column: Visitor Guestbook (Matching Frame 30s) */}
        <div className="w-full md:w-[54%] border-r-2 border-black flex flex-col bg-[#e6e6e6]">
          {/* Guestbook Header */}
          <div className="p-3 border-b-2 border-black flex flex-wrap items-center justify-between gap-2 bg-[#d8d8d8]">
            <div className="flex items-center gap-2">
              <span className="text-base">??</span>
              <span className="font-bold text-sm tracking-wide">Visitor Guestbook</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-700">Search</span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search comments..."
                className="px-2 py-0.5 text-xs bg-white border border-black outline-none font-mono w-28 md:w-32"
              />

              <button
                onClick={() => { retroAudio.playClickSound(); setShowPostModal(true); }}
                className="px-2.5 py-1 text-[11px] font-bold bg-[#3b82f6] text-white border-2 border-t-[#93c5fd] border-l-[#93c5fd] border-r-black border-b-black shadow active:translate-y-0.5 cursor-pointer hover:bg-blue-600 transition-colors"
              >
                Post your own message
              </button>
            </div>
          </div>

          {/* Comments List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {filteredComments.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">
                No comments found matching &quot;{searchTerm}&quot;
              </div>
            ) : (
              filteredComments.map((item) => (
                <div 
                  key={item.id}
                  className="bg-white border-2 border-black p-3 shadow-[2px_2px_0px_rgba(0,0,0,0.6)] space-y-1.5"
                >
                  <div className="font-bold text-xs text-black">
                    {item.name}
                  </div>
                  <p className="text-xs text-slate-800 leading-relaxed font-sans font-medium">
                    {item.message}
                  </p>
                  <div className="text-[10px] text-slate-500 font-mono">
                    {item.date}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Messages from the Creator (Matching Frame 30s) */}
        <div className="w-full md:w-[46%] p-4 overflow-y-auto bg-[#dedede] flex flex-col justify-start">
          <h3 className="font-bold text-xs tracking-wider mb-3 text-slate-800 uppercase">
            Messages from the Creator
          </h3>

          <div className="bg-white border-2 border-black p-4 shadow-[4px_4px_0px_rgba(0,0,0,0.7)] space-y-3">
            <div>
              <h4 className="font-bold text-sm text-black">
                {activeUser}
              </h4>
              <p className="font-bold text-xs text-slate-900 mt-1">
                Thankyou for such Lovely Messages!
              </p>
              <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                Aug 2, 2026, 10:35 PM
              </p>
            </div>

            <div className="text-xs text-slate-800 leading-relaxed space-y-2.5 font-sans">
              <p>
                To everyone who has taken the time to leave a positive comment on this project, thank you so much. Reading your feedback has genuinely meant a lot to me. Every kind word, suggestion, and message of encouragement has made all the time and effort I put into this project feel worthwhile.
              </p>
              <p>
                I am incredibly grateful for your support, and I am excited to keep improving the project and building even more with your feedback. Thank you for being a part of this journey.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Post Modal Dialog */}
      {showPostModal && (
        <div className="absolute inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#dfdfdf] border-2 border-t-white border-l-white border-r-black border-b-black shadow-[6px_6px_0px_rgba(0,0,0,0.8)] p-4 text-black font-pixel">
            <div className="flex justify-between items-center border-b border-slate-400 pb-1.5 mb-3">
              <span className="font-bold text-xs">Leave a Guestbook Message</span>
              <button 
                onClick={() => setShowPostModal(false)}
                className="hover:text-rose-600 font-bold text-xs"
              >
                ?
              </button>
            </div>

            <form onSubmit={handlePostSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Your Name / Handle:</label>
                <input
                  type="text"
                  value={postName}
                  onChange={(e) => setPostName(e.target.value)}
                  placeholder="Stranger / Visitor Name"
                  required
                  autoFocus
                  className="w-full px-2 py-1 text-xs bg-white border border-black outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Your Message:</label>
                <textarea
                  value={postMessage}
                  onChange={(e) => setPostMessage(e.target.value)}
                  placeholder="Share your thoughts or leave a greeting..."
                  rows={3}
                  required
                  className="w-full px-2 py-1 text-xs bg-white border border-black outline-none font-sans"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-300">
                <button
                  type="button"
                  onClick={() => setShowPostModal(false)}
                  className="px-3 py-1 text-xs bg-slate-200 border border-black hover:bg-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 text-xs font-bold bg-[#3b82f6] text-white border border-black hover:bg-blue-600 cursor-pointer"
                >
                  Post Message
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
