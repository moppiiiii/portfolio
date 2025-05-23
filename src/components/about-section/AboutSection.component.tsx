"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import Image from "next/image";
import { useRef } from "react";

export default function AboutSection() {
  const sectionRef = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], [100, -100]);
  const opacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0, 1, 1, 0]);

  return (
    <section
      id="about"
      ref={sectionRef}
      className="py-20 md:py-32 relative overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-b from-black via-purple-950/20 to-black z-0" />

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            About{" "}
            <span className="bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
              Me
            </span>
          </h2>
          <div className="w-20 h-1 bg-gradient-to-r from-purple-500 to-pink-500 mx-auto" />
        </motion.div>

        <div className="grid md:grid-cols-2 gap-12 items-center">
          <motion.div style={{ y, opacity }} className="relative">
            <div className="relative w-full h-[500px] md:h-[500px] rounded-lg overflow-hidden">
              <Image
                src="/images/profile.png"
                alt="Developer Portrait"
                fill
                className="object-cover"
              />
            </div>

            <div className="absolute -bottom-5 -right-5 w-32 h-32 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full opacity-70 blur-xl" />
            <div className="absolute -top-5 -left-5 w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full opacity-70 blur-xl" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            viewport={{ once: true }}
          >
            <h3 className="text-2xl font-bold mb-10">
              Frontend Engineer & Playing Manager
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold mb-2 text-purple-400">Name</h4>
                <p className="text-gray-300">Tomohisa Tanaka</p>
              </div>
              <div>
                <h4 className="font-semibold mb-2 text-purple-400">Location</h4>
                <p className="text-gray-300">Osaka, Japan</p>
              </div>
              <div>
                <h4 className="font-semibold mb-2 text-purple-400">Role</h4>
                <p className="text-gray-300">Frontend Engineer</p>
              </div>
            </div>

            <div className="mt-8">
              <a
                href="#contact"
                className="inline-block bg-gradient-to-r from-purple-600 to-pink-600 text-white font-medium py-3 px-8 rounded-full hover:from-purple-700 hover:to-pink-700 transition-all duration-300 transform hover:scale-105"
              >
                Contact Me
              </a>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
