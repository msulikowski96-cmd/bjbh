import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, Activity, TrendingUp, Calendar, Target } from 'lucide-react';

interface DemoTabProps {
  onGetStarted?: () => void;
  isLanding?: boolean;
}

export default function DemoTab({ onGetStarted, isLanding = false }: DemoTabProps) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setStep((prev) => (prev + 1) % 4);
    }, 4000); // Change slide every 4 seconds
    return () => clearInterval(timer);
  }, []);

  const variants = {
    enter: { opacity: 0, scale: 0.9, filter: "blur(10px)" },
    center: { opacity: 1, scale: 1, filter: "blur(0px)" },
    exit: { opacity: 0, scale: 1.1, filter: "blur(10px)" }
  };

  return (
    <div className={`w-full bg-black overflow-hidden relative flex items-center justify-center text-white font-sans ${isLanding ? 'h-screen' : 'h-[calc(100vh-6rem)] rounded-3xl'}`}>
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div 
          animate={{ 
            background: [
              "radial-gradient(circle at 20% 50%, #450a0a 0%, #000000 100%)", // Dark Red
              "radial-gradient(circle at 80% 20%, #172554 0%, #000000 100%)", // Dark Blue
              "radial-gradient(circle at 50% 50%, #3b0764 0%, #000000 100%)", // Dark Purple
              "radial-gradient(circle at 50% 80%, #022c22 0%, #000000 100%)"  // Dark Green
            ][step]
          }}
          transition={{ duration: 1 }}
          className="absolute inset-0 opacity-50"
        />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay"></div>
        
        {/* Animated Lines */}
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] opacity-10"
          style={{
            background: "conic-gradient(from 0deg at 50% 50%, transparent 0deg, rgba(255,255,255,0.1) 60deg, transparent 120deg)"
          }}
        />
      </div>

      {/* Persistent Get Started Button for Landing Mode */}
      {isLanding && (
        <div className="absolute top-8 right-8 z-50">
          <button 
            onClick={onGetStarted}
            className="bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white px-6 py-2 rounded-full text-sm font-bold transition-all"
          >
            Zaloguj się
          </button>
        </div>
      )}

      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div
            key="step1"
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.8, ease: "easeInOut" }}
            className="text-center z-10 p-8"
          >
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-block px-3 py-1 rounded-full border border-red-500/30 bg-red-500/10 text-red-400 text-xs font-bold tracking-widest uppercase mb-6"
            >
              Problem
            </motion.div>
            <h2 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
              Walczysz z <span className="text-red-500">wagą</span>?
            </h2>
            <p className="text-xl md:text-2xl text-gray-400 font-light">
              I wciąż nie widzisz efektów?
            </p>
          </motion.div>
        )}

        {step === 1 && (
          <motion.div
            key="step2"
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.8, ease: "easeInOut" }}
            className="text-center z-10 p-8"
          >
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 20 }}
              className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-3xl mx-auto mb-8 flex items-center justify-center shadow-2xl shadow-blue-500/20"
            >
              <span className="font-serif italic text-5xl font-bold">M</span>
            </motion.div>
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="inline-block px-3 py-1 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400 text-xs font-bold tracking-widest uppercase mb-6"
            >
              Poznaj
            </motion.div>
            <h2 className="text-5xl md:text-7xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
              MetabolicAI
            </h2>
            <p className="text-xl md:text-2xl text-blue-200/80 font-light max-w-2xl mx-auto">
              Twój osobisty asystent zdrowia napędzany sztuczną inteligencją.
            </p>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="step3"
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.8, ease: "easeInOut" }}
            className="text-center z-10 w-full max-w-4xl p-8"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-12 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/50">
              Przejmij kontrolę
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { icon: <Activity className="w-8 h-8 text-blue-400" />, title: "Analiza BMI/BMR", desc: "Precyzyjne wyliczenia metaboliczne" },
                { icon: <TrendingUp className="w-8 h-8 text-purple-400" />, title: "Śledzenie Wagi", desc: "Wizualizacja Twoich postępów" },
                { icon: <Target className="w-8 h-8 text-green-400" />, title: "Cele Zdrowotne", desc: "Inteligentne planowanie diety" }
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + (i * 0.1) }}
                  className="bg-white/5 backdrop-blur-lg border border-white/10 p-6 rounded-2xl text-left hover:bg-white/10 transition-colors"
                >
                  <div className="mb-4 bg-white/5 w-14 h-14 rounded-xl flex items-center justify-center">
                    {item.icon}
                  </div>
                  <h3 className="text-xl font-bold mb-2">{item.title}</h3>
                  <p className="text-sm text-gray-400">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div
            key="step4"
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.8, ease: "easeInOut" }}
            className="text-center z-10 p-8"
          >
            <h2 className="text-6xl md:text-8xl font-bold mb-8 leading-none tracking-tight">
              Zdobądź<br/>
              <span className="text-blue-500">formę życia.</span>
            </h2>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onGetStarted}
              className="bg-white text-black px-8 py-4 rounded-full font-bold text-lg flex items-center gap-2 mx-auto hover:bg-blue-50 transition-colors"
            >
              Get Started <ChevronRight />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress Indicators */}
      <div className="absolute bottom-8 flex gap-2 z-20">
        {[0, 1, 2, 3].map((i) => (
          <div 
            key={i}
            className={`h-1 rounded-full transition-all duration-300 ${i === step ? "w-8 bg-white" : "w-2 bg-white/20"}`}
          />
        ))}
      </div>
    </div>
  );
}
