import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useGardenAudio } from './hooks/useGardenAudio';
import { NUMBER_MAPS, GOOGLE_COLORS } from './constants';

interface NodeData {
  id: number;
  isActive: boolean;
  isGhost: boolean;
  color: string;
}

export default function App() {
  const [gameStarted, setGameStarted] = useState(false);
  const [currentNumber, setCurrentNumber] = useState(10);
  const [nodes, setNodes] = useState<NodeData[]>([]);
  const [playheadCol, setPlayheadCol] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [particles, setParticles] = useState<{ id: number; x: number; y: number; tx: number; ty: number; color: string; type: 'pollen' | 'sparkle' }[]>([]);
  const { initAudio, playChime, playSuccessArpeggio } = useGardenAudio();

  // Initialize nodes
  useEffect(() => {
    const initialNodes = Array.from({ length: 64 }, (_, i) => ({
      id: i,
      isActive: false,
      isGhost: false,
      color: GOOGLE_COLORS[0],
    }));
    setNodes(initialNodes);
  }, []);

  // Particle creation (pollen & sparkles)
  const particleCounter = useRef(0);
  const triggerParticles = useCallback((elementId: string, count = 5) => {
    const el = document.getElementById(elementId);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    
    const newParticles = Array.from({ length: count }).map((_, i) => {
      particleCounter.current += 1;
      return {
        id: particleCounter.current,
        x,
        y,
        tx: (Math.random() - 0.5) * 140,
        ty: -Math.random() * 140 - 60,
        color: Math.random() > 0.6 ? '#fff9e6' : '#ffe066',
        type: (Math.random() > 0.8 ? 'sparkle' : 'pollen') as 'pollen' | 'sparkle'
      };
    });

    setParticles(prev => [...prev.slice(-60), ...newParticles]);
    
    // Cleanup based on IDs directly to avoid stale closures
    const idsToClear = newParticles.map(p => p.id);
    setTimeout(() => {
      setParticles(prev => prev.filter(p => !idsToClear.includes(p.id)));
    }, 2000);
  }, []);

  // Load a new number pattern
  const loadNumber = useCallback((num: number) => {
    if (num < 1) return;
    const target = NUMBER_MAPS[num];
    setNodes(prev => prev.map((node, i) => {
      const isTarget = target.includes(i);
      let isActive = false;
      let color = node.color;
      
      // Randomly pre-fill some target nodes
      if (isTarget && Math.random() > 0.55) {
        isActive = true;
        color = GOOGLE_COLORS[Math.floor(Math.random() * GOOGLE_COLORS.length)];
      }

      return {
        ...node,
        isActive,
        isGhost: isTarget,
        color
      };
    }));

    // Ensure at least one target is unbloomed so user has to interact
    setNodes(prev => {
        const targetIndices = NUMBER_MAPS[num];
        const activeTargets = prev.filter((n, i) => targetIndices.includes(i) && n.isActive);
        if (activeTargets.length === targetIndices.length) {
            const firstTarget = targetIndices[0];
            const nextNodes = [...prev];
            nextNodes[firstTarget].isActive = false;
            return nextNodes;
        }
        return prev;
    });
  }, []);

  // Sequencer loop
  useEffect(() => {
    if (!gameStarted) return;

    const interval = setInterval(() => {
      setPlayheadCol(prev => (prev + 1) % 8);
    }, 250);

    return () => clearInterval(interval);
  }, [gameStarted]);

  // Audio trigger for sequencer
  useEffect(() => {
    if (!gameStarted) return;
    for (let row = 0; row < 8; row++) {
      const nodeIdx = row * 8 + playheadCol;
      const node = nodes[nodeIdx];
      if (node?.isActive) {
        playChime(row);
        // Visual feedback pollen
        if (Math.random() > 0.6) {
           triggerParticles(`node-${nodeIdx}`, 2);
        }
      }
    }
  }, [playheadCol, gameStarted, nodes, playChime, triggerParticles]);

  // Handle building startup
  useEffect(() => {
    if (gameStarted) {
      loadNumber(10);
    }
  }, [gameStarted, loadNumber]);

  const handleNodeClick = (index: number) => {
    if (isTransitioning || !gameStarted) return;
    
    setNodes(prev => prev.map((n, i) => {
      if (i === index) {
        const newIsActive = !n.isActive;
        if (newIsActive) {
          playChime(Math.floor(i / 8));
          triggerParticles(`node-${index}`, 12);
        }
        return {
          ...n,
          isActive: newIsActive,
          color: newIsActive ? GOOGLE_COLORS[Math.floor(Math.random() * GOOGLE_COLORS.length)] : n.color
        };
      }
      return n;
    }));
  };

  // Check for completion
  useEffect(() => {
    if (isTransitioning || !gameStarted || currentNumber < 1) return;

    const targetIndices = NUMBER_MAPS[currentNumber];
    const activeIndices = nodes.filter(n => n.isActive).map(n => n.id);

    // If all target nodes are active, trigger transition (be more forgiving of extra nodes)
    const isExactMatch = targetIndices.every(idx => activeIndices.includes(idx));
    if (isExactMatch && !isTransitioning) {
      triggerBreezeTransition();
    }
  }, [nodes, currentNumber, isTransitioning, gameStarted]);

  const triggerBreezeTransition = useCallback(() => {
    setIsTransitioning(true);
    playSuccessArpeggio();

    setTimeout(() => {
      // Transition logic
      if (currentNumber > 1) {
        const nextNum = currentNumber - 1;
        setCurrentNumber(nextNum);
        loadNumber(nextNum);
        setIsTransitioning(false);
      } else {
        // Grand finale wave animation
        setCurrentNumber(0);
        
        // Clear all ghosts first
        setNodes(prev => prev.map(n => ({ ...n, isGhost: false })));
        
        let delay = 0;
        for (let col = 0; col < 8; col++) {
          setTimeout(() => {
            setNodes(prev => prev.map((n, i) => {
              if (i % 8 === col) {
                return {
                  ...n,
                  isActive: true,
                  color: GOOGLE_COLORS[Math.floor(Math.random() * GOOGLE_COLORS.length)]
                };
              }
              return n;
            }));
            
            // Sound and lots of sparkles for the finale wave
            for(let r=0; r<8; r++) {
               playChime(r, true);
               triggerParticles(`node-${r*8 + col}`, 12);
            }

            if (col === 7) {
              setGameStarted(false);
              setIsTransitioning(false);
            }
          }, delay);
          delay += 100;
        }
      }
    }, 1200);
  }, [currentNumber, loadNumber, playChime, playSuccessArpeggio, triggerParticles]);

  const restartGame = () => {
    setCurrentNumber(10);
    loadNumber(10);
    setGameStarted(true);
    setIsTransitioning(false);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen font-sans">
      <AnimatePresence>
        {!gameStarted && (
          <motion.div
            id="start-screen"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-bg-dark/90 backdrop-blur-xl z-50 flex flex-col items-center justify-center text-center p-6"
          >
            <h1 className="text-6xl font-semibold mb-2 tracking-tighter">
              <span className="text-google-blue">G</span>
              <span className="text-google-red">a</span>
              <span className="text-google-yellow">r</span>
              <span className="text-google-blue">d</span>
              <span className="text-google-green">e</span>
              <span className="text-google-red">n</span>
            </h1>
            <p className="text-lg text-emerald-100/70 max-w-md mb-8 leading-relaxed">
              The sequence is dormant. Click the green buds to bloom the flowers, fix the pattern, and initiate the countdown.
            </p>
            <button
              id="start-btn"
              onClick={() => {
                initAudio();
                setGameStarted(true);
              }}
              className="px-10 py-4 bg-white/10 border border-white/30 rounded-full text-xl hover:bg-white hover:text-bg-dark transition-all duration-300 hover:scale-105 backdrop-blur-md"
            >
              Wake the Garden
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div 
        id="ui-header"
        initial={{ opacity: 0 }}
        animate={{ opacity: gameStarted ? 1 : 0 }}
        className="mb-10 text-center z-10"
      >
        <div id="status-text" className="text-sm md:text-2xl font-light tracking-[0.2em] text-emerald-100 uppercase">
          {currentNumber === 0 ? (
            <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }}>
              Garden Restored
            </motion.div>
          ) : `Blooming Sequence: ${currentNumber}`}
          {currentNumber === 0 && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={restartGame}
              className="block mx-auto mt-6 text-xs bg-white/10 hover:bg-white text-white hover:text-bg-dark px-6 py-2 rounded-full normal-case tracking-normal transition-all font-medium"
            >
              Plant a New Garden
            </motion.button>
          )}
        </div>
      </motion.div>

      <motion.div
        id="garden-container"
        initial={{ opacity: 0 }}
        animate={{ opacity: gameStarted ? 1 : 0 }}
        className="relative"
      >
        {/* Sunbeam Playhead */}
        <motion.div
          id="sunbeam"
          animate={{ x: playheadCol * 75 }}
          className="absolute -top-5 -bottom-5 w-[75px] bg-gradient-to-r from-yellow-100/0 via-yellow-100/15 to-yellow-100/0 -left-[7.5px] rounded-full pointer-events-none z-10 mix-blend-overlay"
          transition={{ type: 'tween', ease: 'linear', duration: 0.25 }}
        />

        {/* Grid */}
        <div id="grid" className="grid grid-cols-8 grid-rows-8 gap-3.5 relative z-0">
          {nodes.map((node, i) => (
            <div
              key={i}
              id={`node-${i}`}
              onClick={() => handleNodeClick(i)}
              className={`w-[60px] h-[60px] flex items-center justify-center cursor-pointer relative group`}
            >
              <AnimatePresence mode="wait">
                {!node.isActive ? (
                  <motion.div
                    key="bud"
                    className={`bud-shape w-6 h-6 rotate-45 transform-gpu transition-colors flex items-center justify-center overflow-hidden ${
                      node.isGhost ? 'border-2 border-dashed border-ghost bg-transparent' : 'bg-bud shadow-inner group-hover:bg-[#4a634a]'
                    }`}
                    layoutId={`bud-${i}`}
                  >
                    {!node.isGhost && (
                      <div className="absolute w-full h-[1px] bg-white/10 rotate-45" />
                    )}
                    {!node.isGhost && (
                      <div className="absolute h-full w-[1px] bg-white/10 rotate-45" />
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key="flower"
                    initial={{ scale: 0, rotate: -45 }}
                    animate={{ 
                        scale: (Math.floor(i % 8) === playheadCol) ? 1.2 : 1, 
                        rotate: (Math.floor(i % 8) === playheadCol) ? 15 : 0,
                        filter: (Math.floor(i % 8) === playheadCol) ? `brightness(1.3) drop-shadow(0 0 15px ${node.color})` : 'none'
                    }}
                    exit={{ x: 200, y: -150, rotate: 360, scale: 0, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    className="relative w-full h-full pointer-events-none"
                    style={{ '--flower-color': node.color } as React.CSSProperties}
                  >
                    {[0, 1, 2, 3].map(p => (
                      <div
                        key={p}
                        className="petal-shape absolute w-[30px] h-[30px] shadow-inner"
                        style={{
                          backgroundColor: node.color,
                          top: p < 2 ? '5px' : '25px',
                          left: (p === 0 || p === 3) ? '-5px' : '15px',
                          transform: `rotate(${45 + p * 90}deg)`
                        }}
                      />
                    ))}
                    <div className="absolute top-5 left-5 w-5 h-5 bg-[#fff9e6] rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)] z-10" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Particles (Pollen & Sparkles) */}
      <AnimatePresence>
        {particles.map(p => (
          <motion.div
            key={p.id}
            initial={{ x: p.x, y: p.y, scale: 1, opacity: 0.8 }}
            animate={{ 
              x: p.x + p.tx, 
              y: p.y + p.ty, 
              scale: p.type === 'sparkle' ? [1, 1.5, 0] : 0, 
              opacity: 0,
              rotate: p.type === 'sparkle' ? 180 : 0
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: p.type === 'sparkle' ? 1.5 : 2, ease: [0.25, 1, 0.5, 1] }}
            className={`fixed rounded-full pointer-events-none z-[100] ${
              p.type === 'sparkle' ? 'w-2 h-2 shadow-[0_0_8px_white]' : 'w-1.5 h-1.5'
            }`}
            style={{ backgroundColor: p.color }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
