import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Sparkles } from "lucide-react";

// Generate an array of numbers from 2 to 12
const INITIAL_NUMBERS = Array.from({ length: 11 }, (_, i) => i + 2);

interface CardData {
  id: string;
  value: number;
  isFlipped: boolean;
}

// Fisher-Yates shuffle
const shuffleArray = <T,>(array: T[]): T[] => {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
};

const createDeck = (): CardData[] => {
  const shuffledNumbers = shuffleArray(INITIAL_NUMBERS);
  return shuffledNumbers.map((num) => ({
    id: crypto.randomUUID(),
    value: num,
    isFlipped: false,
  }));
};

function CardGame() {
  const [cards, setCards] = useState<CardData[]>([]);
  const [isShuffling, setIsShuffling] = useState(true);

  // Initialize deck on mount
  useEffect(() => {
    setCards(createDeck());
    const timer = setTimeout(() => setIsShuffling(false), 500);
    return () => clearTimeout(timer);
  }, []);

  const handleFlip = (id: string) => {
    if (isShuffling) return;
    setCards((prev) =>
      prev.map((card) =>
        card.id === id && !card.isFlipped ? { ...card, isFlipped: true } : card
      )
    );
  };

  const handleRandomize = useCallback(() => {
    setIsShuffling(true);
    // Unflip all cards first for visual effect
    setCards((prev) => prev.map((c) => ({ ...c, isFlipped: false })));
    
    setTimeout(() => {
      setCards(createDeck());
      setTimeout(() => {
        setIsShuffling(false);
      }, 400); // Time for cards to settle
    }, 400); // Time for flip back animation
  }, []);

  const revealedCount = cards.filter((c) => c.isFlipped).length;
  const isComplete = revealedCount === 11 && cards.length > 0;

  return (
    <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center p-4 md:p-8 overflow-x-hidden">
      
      <div className="w-full max-w-4xl mx-auto space-y-8 flex flex-col items-center">
        
        {/* Header Section */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white drop-shadow-md">
            Mystery Reveal
          </h1>
          <div className="flex flex-col items-center space-y-6">
            
            <div className="flex items-center gap-4">
              <div className={`px-6 py-2 rounded-full border-2 transition-all duration-500 font-bold text-lg
                ${isComplete 
                  ? 'border-secondary bg-secondary/10 text-secondary scale-110 shadow-[0_0_20px_rgba(0,255,255,0.4)]' 
                  : 'border-muted-foreground/30 bg-card text-muted-foreground'
                }`}
              >
                {isComplete ? (
                  <span className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5" />
                    All Revealed!
                    <Sparkles className="w-5 h-5" />
                  </span>
                ) : (
                  <span>{revealedCount} / 11 REVEALED</span>
                )}
              </div>
            </div>

            <Button 
              onClick={handleRandomize} 
              disabled={isShuffling}
              size="lg"
              className="font-bold tracking-wide text-md rounded-xl h-14 px-8 bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_15px_rgba(255,51,102,0.5)] hover:shadow-[0_0_25px_rgba(255,51,102,0.7)] transition-all"
              data-testid="button-randomize"
            >
              <RefreshCw className={`w-5 h-5 mr-2 ${isShuffling ? 'animate-spin' : ''}`} />
              Randomize Again
            </Button>
            
          </div>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 md:gap-6 w-full justify-items-center">
          {cards.map((card, index) => (
            <div
              key={card.id}
              className="w-full max-w-[160px] aspect-[3/4] perspective-1000 select-none cursor-pointer"
              onClick={() => handleFlip(card.id)}
              data-testid={`card-${card.value}`}
              style={{
                transitionDelay: `${isShuffling ? index * 30 : 0}ms`,
                transform: isShuffling 
                  ? `translateY(${Math.random() * 40 - 20}px) translateX(${Math.random() * 40 - 20}px) scale(0.9) rotate(${Math.random() * 10 - 5}deg)`
                  : 'translateY(0) translateX(0) scale(1) rotate(0deg)',
                transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)'
              }}
            >
              <div 
                className={`relative w-full h-full duration-500 transform-style-3d ${
                  card.isFlipped ? 'rotate-y-180' : 'hover:-translate-y-2'
                }`}
                style={{
                  transitionProperty: 'transform',
                  transitionDuration: '0.6s',
                  transitionTimingFunction: 'cubic-bezier(0.2, 0.8, 0.2, 1)'
                }}
              >
                {/* Card Back (Facedown) */}
                <div className="absolute inset-0 w-full h-full backface-hidden rounded-2xl shadow-xl border-4 border-primary/40 overflow-hidden card-back-pattern" />

                {/* Card Front (Faceup) */}
                <div className="absolute inset-0 w-full h-full backface-hidden rotate-y-180 bg-white rounded-2xl shadow-2xl border-4 border-secondary/50 flex items-center justify-center">
                  <div className="absolute inset-2 border-2 border-dashed border-gray-200 rounded-xl" />
                  <span className="text-6xl md:text-7xl font-black text-slate-900 z-10" style={{ textShadow: '2px 2px 0px rgba(0,255,255,0.3)' }}>
                    {card.value}
                  </span>
                </div>
              </div>
            </div>
          ))}
          {/* Placeholder for the 12th slot in a 4-col grid to keep it centered or just let it flow */}
        </div>

      </div>
    </div>
  );
}

export default function App() {
  return <CardGame />;
}
