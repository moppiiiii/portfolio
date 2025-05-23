"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export default function CursorFollower() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    const handleMouseOver = (e: MouseEvent) => {
      if (
        e.target instanceof HTMLElement &&
        (e.target.tagName === "A" ||
          e.target.tagName === "BUTTON" ||
          e.target.closest("a") ||
          e.target.closest("button"))
      ) {
        setIsHovering(true);
      } else {
        setIsHovering(false);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseover", handleMouseOver);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseover", handleMouseOver);
    };
  }, []);

  // Hide on mobile devices
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  if (isMobile) return null;

  return (
    <motion.div
      className="fixed top-0 left-0 w-12 h-12 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 opacity-70 mix-blend-difference pointer-events-none z-50 backdrop-blur-sm"
      animate={{
        x: mousePosition.x - 24,
        y: mousePosition.y - 24,
        scale: isHovering ? 1.5 : 1,
      }}
      transition={{
        type: "spring",
        mass: 0.2,
        stiffness: 100,
        damping: 10,
        ease: "linear",
      }}
    />
  );
}
