import AboutSection from "@/components/about-section";
import ContactSection from "@/components/contact-section";
import CursorFollower from "@/components/cursor-follower";
import Footer from "@/components/footer";
import HeroSection from "@/components/hero-section";
import Navbar from "@/components/nav-bar";
import ProjectsSection from "@/components/project-section";
import SkillsSection from "@/components/skill-section";

import type { Metadata } from "next";

export const runtime = "edge";

export const metadata: Metadata = {
  title: "Portfolio | Frontend Engineer",
  description: "Frontend Engineer portfolio",
  openGraph: {
    title: "Portfolio | Frontend Engineer",
    description: "Frontend Engineer portfolio",
    images: [
      {
        url: "/image/profile.png",
        width: 1200,
        height: 630,
        alt: "プロフィール画像",
      },
    ],
  },
};

export default function Home() {
  return (
    <div className="relative overflow-hidden bg-black text-white">
      <CursorFollower />
      <Navbar />
      <main>
        <HeroSection />
        <AboutSection />
        <SkillsSection />
        <ProjectsSection />
        <ContactSection />
      </main>
      <Footer />
    </div>
  );
}
