import Image from "next/image";
import Link from "next/link";
import { SlSocialLinkedin } from "react-icons/sl";

const teamMembers = [
  {
    name: "Jaden Kwan",
    title: "CEO",
    image: "/assets/images/jaden.png",
    backgroundColor: "#fd5302",
    linkedin: "#",
  },
  {
    name: "Max Ta",
    title: "CTO",
    image: "/assets/images/max.png",
    backgroundColor: "#fd5302",
    linkedin: "#",
  },
  {
    name: "Joe Lim",
    title: "COO",
    image: "/assets/images/joe.png",
    backgroundColor: "#29bfd5",
    linkedin: "#",
  },
  {
    name: "Henry Zheng",
    title: "Founding Engineer",
    image: "/assets/images/henry.png",
    backgroundColor: "#f99ed4",
    linkedin: "#",
  },
];

export default function Team() {
  return (
    <section className="bg-[#f5f1e3] pt-12 pb-12 sm:py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row gap-8 sm:gap-12 lg:gap-16 items-start">
          {/* Left Content */}
          <div className="lg:w-1/3 w-full">
            <p className="font-label text-xs tracking-widest text-[#133333] uppercase mb-4">
              Team
            </p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-normal text-[#133333] leading-tight mb-6">
              Meet the team
            </h2>
            <p className="font-label text-[#133333]/70 text-base leading-relaxed">
              Our philosophy is simple: hire great people and give them the tools to do great work.
            </p>
          </div>

          {/* Right Content - Team Grid */}
          <div className="lg:w-2/3 w-full">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 sm:gap-6">
              {teamMembers.map((member, index) => (
                <div key={index} className="flex flex-col sm:items-start w-full">
                  <div
                    className="relative w-full aspect-square rounded-xl overflow-hidden"
                    style={{ backgroundColor: member.backgroundColor }}
                  >
                    <Image
                      src={member.image}
                      alt={member.name}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 100vw, 50vw"
                    />
                  </div>
                  <div className="flex items-center justify-between w-full mt-4 sm:block">
                    <div className="flex items-center gap-3 sm:block">
                      <h3 className="text-xl font-serif font-normal text-[#133333] mb-1 sm:mb-1">
                        {member.name}
                      </h3>
                      <div className="h-4 w-px bg-[#133333]/20 sm:hidden"></div>
                      <Link
                        href={member.linkedin}
                        className="text-[#0D3B42] sm:hidden"
                        aria-label={`${member.name} LinkedIn`}
                      >
                        <SlSocialLinkedin className="h-5 w-5" />
                      </Link>
                    </div>
                  </div>
                  {member.title && (
                    <p className="font-label text-[#133333]/70 text-sm mb-4 text-left w-full">
                      {member.title}
                    </p>
                  )}
                  <div className="hidden sm:flex gap-3 justify-start w-full">
                    <Link
                      href={member.linkedin}
                      className="text-[#0D3B42]"
                      aria-label={`${member.name} LinkedIn`}
                    >
                      <SlSocialLinkedin className="h-5 w-5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

