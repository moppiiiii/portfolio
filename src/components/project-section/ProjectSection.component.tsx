"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ExternalLink, Github, X } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { PROJECTS } from "./constants";
export default function ProjectsSection() {
  const [selectedProject, setSelectedProject] = useState<number | null>(null);

  const currentProject =
    selectedProject !== null
      ? PROJECTS.find((project) => project.id === selectedProject)
      : null;

  return (
    <section id="projects" className="py-20 md:py-32 bg-black relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(120,50,255,0.15),transparent_50%)]" />

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
              Projects
            </span>
          </h2>
          <div className="w-20 h-1 bg-gradient-to-r from-purple-500 to-pink-500 mx-auto" />
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {PROJECTS.map((project, index) => (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              whileHover={{ y: -10 }}
              className="bg-gray-900/50 backdrop-blur-sm rounded-xl overflow-hidden border border-gray-800 group"
            >
              <div className="relative h-48 overflow-hidden">
                <Image
                  src={project.image || "/placeholder.svg"}
                  alt={project.title}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <button
                    type="button"
                    onClick={() => setSelectedProject(project.id)}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-full transition-all duration-300 transform hover:scale-105"
                  >
                    View Details
                  </button>
                </div>
              </div>

              <div className="p-6">
                <div className="mb-2">
                  <span className="text-xs font-medium text-purple-400 bg-purple-400/10 px-2 py-1 rounded-full">
                    {project.category}
                  </span>
                </div>

                <h3 className="text-xl font-bold mb-2 text-white">
                  {project.title}
                </h3>

                <div className="flex flex-wrap gap-2 mt-4">
                  {project.technologies.slice(0, 3).map((tech) => (
                    <span
                      key={tech}
                      className="text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded"
                    >
                      {tech}
                    </span>
                  ))}
                  {project.technologies.length > 3 && (
                    <span className="text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded">
                      +{project.technologies.length - 3}
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Project Modal */}
      <AnimatePresence>
        {selectedProject !== null && currentProject && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gray-900 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto relative"
            >
              <button
                type="button"
                onClick={() => setSelectedProject(null)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white z-10"
              >
                <X size={24} />
              </button>

              <div className="relative h-64 md:h-80">
                <Image
                  src={currentProject.image || "/placeholder.svg"}
                  alt={currentProject.title}
                  fill
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-gray-900 to-transparent" />
              </div>

              <div className="p-6 md:p-8">
                <div className="mb-4">
                  <span className="text-sm font-medium text-purple-400 bg-purple-400/10 px-3 py-1 rounded-full">
                    {currentProject.category}
                  </span>
                </div>

                <h3 className="text-2xl md:text-3xl font-bold mb-4 text-white">
                  {currentProject.title}
                </h3>

                <p className="text-gray-300 mb-6">
                  {currentProject.description}
                </p>

                <div className="mb-6">
                  <h4 className="text-lg font-semibold mb-3">Technologies</h4>
                  <div className="flex flex-wrap gap-2">
                    {currentProject.technologies.map((tech) => (
                      <span
                        key={tech}
                        className="text-sm bg-gray-800 text-gray-300 px-3 py-1 rounded"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex gap-4">
                  <a
                    href={currentProject.liveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-2 rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all duration-300"
                  >
                    <ExternalLink size={18} />
                    <span>Live Demo</span>
                  </a>

                  <a
                    href={currentProject.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-all duration-300"
                  >
                    <Github size={18} />
                    <span>Source Code</span>
                  </a>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
