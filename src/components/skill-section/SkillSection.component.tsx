"use client";

import { motion } from "framer-motion";
import { Code, Database, Lightbulb, Palette } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import {
  BACKEND_SKILLS,
  DEVELOPMENT_TOOLS_SKILLS,
  FRONTEND_SKILLS,
  STYLING_UI_SKILLS,
  TESTING_SKILLS,
} from "./constants";

const skillCategories = [
  {
    id: "frontend",
    title: "Frontend",
    icon: <Code size={24} />,
    skills: FRONTEND_SKILLS,
  },
  {
    id: "backend",
    title: "Backend",
    icon: <Code size={24} />,
    skills: BACKEND_SKILLS,
  },
  {
    id: "styling",
    title: "Styling & UI",
    icon: <Palette size={24} />,
    skills: STYLING_UI_SKILLS,
  },
  {
    id: "tools",
    title: "Development Tools",
    icon: <Lightbulb size={24} />,
    skills: DEVELOPMENT_TOOLS_SKILLS,
  },
  {
    id: "testing",
    title: "Testing",
    icon: <Database size={24} />,
    skills: TESTING_SKILLS,
  },
];

export default function SkillsSection() {
  const [activeCategory, setActiveCategory] = useState("frontend");

  const activeSkills = skillCategories.find(
    (category) => category.id === activeCategory,
  )?.skills;

  return (
    <section id="skills" className="py-20 md:py-32 bg-black relative">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(120,50,255,0.15),transparent_70%)]" />

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            My{" "}
            <span className="bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
              Skills
            </span>
          </h2>
          <div className="w-20 h-1 bg-gradient-to-r from-purple-500 to-pink-500 mx-auto" />
        </motion.div>

        <div className="grid md:grid-cols-4 gap-4 mb-12">
          {skillCategories.map((category) => (
            <motion.button
              key={category.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
              onClick={() => setActiveCategory(category.id)}
              className={`flex items-center justify-center gap-2 py-4 px-6 rounded-lg transition-all duration-300 ${
                activeCategory === category.id
                  ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white"
                  : "bg-gray-900 text-gray-300 hover:bg-gray-800"
              }`}
            >
              <span>{category.icon}</span>
              <span className="font-medium">{category.title}</span>
            </motion.button>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
          {activeSkills?.map((skill, index) => (
            <motion.div
              key={skill.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.05 }}
              className="bg-gray-900/50 backdrop-blur-sm p-6 rounded-lg border border-gray-800 flex flex-col items-center justify-center group hover:bg-gray-800/50 transition-all duration-300"
            >
              <div className="w-16 h-16 mb-4 relative flex items-center justify-center">
                <Image
                  src={skill.icon || "/placeholder.svg"}
                  alt={skill.name}
                  width={48}
                  height={48}
                  className="transition-transform duration-300 group-hover:scale-110"
                  unoptimized
                />
              </div>
              <h3 className="text-center text-gray-300 group-hover:text-white transition-colors duration-300">
                {skill.name}
              </h3>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
