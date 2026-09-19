import { useState, useEffect } from 'react';
import { Volume2, Square, VolumeX } from 'lucide-react';
import { TextToSpeech, SoundEffects } from '../utils/speech';

interface AudioPlayerButtonProps {
  textToRead?: string;
  text?: string;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  id?: string;
  textId?: string;
  themeMode?: string;
}

export function AudioPlayerButton({
  textToRead,
  text,
  label = 'Read Aloud',
  size = 'md',
  className = '',
  id,
  textId,
}: AudioPlayerButtonProps) {
  const content = textToRead || text || '';
  const [isPlayingThis, setIsPlayingThis] = useState(false);
  const [isSupported, setIsSupported] = useState(true);

  // Generate a stable unique text ID
  const uniqueId = id || textId || `btn-tts-${content.slice(0, 20).replace(/\W/g, '')}`;

  useEffect(() => {
    setIsSupported(TextToSpeech.isSupported());

    // Subscribe to centralized speech state
    const unsubscribe = TextToSpeech.subscribeState((activeId) => {
      setIsPlayingThis(activeId === uniqueId);
    });

    return () => {
      unsubscribe();
    };
  }, [uniqueId]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (isPlayingThis) {
      TextToSpeech.stop();
      SoundEffects.playSoftChime();
    } else {
      // If currently muted, user actively tapping "Read Aloud" un-mutes automatically
      if (TextToSpeech.isMuted()) {
        TextToSpeech.setMuted(false);
      }

      TextToSpeech.speak(
        content,
        uniqueId,
        () => {
          setIsPlayingThis(true);
        },
        () => {
          setIsPlayingThis(false);
          SoundEffects.playSuccessChime();
        },
        (err) => {
          console.warn('Speech playback issue:', err);
          setIsPlayingThis(false);
        }
      );
    }
  };

  if (!isSupported || !content.trim()) {
    return null;
  }

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm sm:text-base gap-1.5 min-h-[38px]',
    md: 'px-4 py-2.5 text-base sm:text-lg gap-2 min-h-[46px]',
    lg: 'px-6 py-3.5 text-lg sm:text-xl gap-2.5 min-h-[54px]',
  }[size];

  return (
    <button
      id={uniqueId}
      type="button"
      onClick={handleToggle}
      className={`inline-flex items-center justify-center font-black rounded-2xl transition-all shadow-lumina-xs focus:outline-none focus:ring-4 focus:ring-amber-400 select-none ${
        isPlayingThis
          ? 'bg-[#991B1B] text-white hover:bg-[#7F1D1D] border-2 border-[#7F1D1D] ring-2 ring-[#DC2626] animate-pulse'
          : 'bg-white text-[#0F172A] hover:bg-[#F8FAFC] border-2 border-[#CBD5E1] hover:border-[#D97706] active:scale-[0.98]'
      } ${sizeClasses} ${className}`}
      title={
        isPlayingThis
          ? 'Click to stop reading'
          : 'Click to hear this read aloud in clear, gentle speech'
      }
      aria-label={isPlayingThis ? 'Stop reading aloud' : `Read text aloud: ${label}`}
    >
      {isPlayingThis ? (
        <>
          <Square className="w-5 h-5 fill-current shrink-0" />
          <span>Stop Reading</span>
        </>
      ) : (
        <>
          <Volume2 className="w-5 h-5 text-[#D97706] stroke-[2.5] shrink-0" />
          <span>{label}</span>
        </>
      )}
    </button>
  );
}
