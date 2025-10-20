import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface LoadingBarProps {
  isLoading: boolean;
  speed?: number; // seconds per full gradient loop
}

const LoadingBar: React.FC<LoadingBarProps> = ({ isLoading, speed = 1 }) => {
  const [visible, setVisible] = useState(isLoading);

  useEffect(() => {
    if (isLoading) {
      setVisible(true);
    } else {
      const t = setTimeout(() => setVisible(false), speed * 1000);
      return () => clearTimeout(t);
    }
  }, [isLoading, speed]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{
            opacity: 0,
            scaleY: 0.3,
            transition: { duration: 0.4, ease: "easeInOut" },
          }}
          className="fixed top-0 left-0 right-0 z-50 h-[8px] rounded-b-xl overflow-hidden"
        >
          {/* moving gradient background instead of element translation */}
          <div
            className="h-full w-full animate-continuous-flash rounded-b-xl"
            style={{
              background:
                "linear-gradient(90deg,#FFB86C 0%,#FF61A6 35%,#9D5CFF 70%,#3AC5FF 100%)",
              backgroundSize: "200% 100%",
              filter: "brightness(1.4) saturate(1.4)",
              boxShadow: "0 0 20px rgba(157,92,255,0.5)",
            }}
          >
            {/* strong white sheen layer */}
            <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.8),transparent)] animate-flash-gloss rounded-b-xl mix-blend-screen" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LoadingBar;
 