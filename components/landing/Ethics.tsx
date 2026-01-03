import Link from "next/link";
import Image from "next/image";

const benefits = [
  {
    title: "Architectural Capability Constraints",
    description: "Core model capabilities are deliberately bounded at the architecture level rather than restricted post-generation.",
    icon: "/assets/svgs/1.svg",
  },
  {
    title: "Curated Training Distributions",
    description: "Training data is selectively sourced and excluded to prevent learning explicit, exploitative, or non-consensual patterns.",
    icon: "/assets/svgs/2.svg",
  },
  {
    title: "Explicit Capability Delimitation",
    description: "Certain generative behaviors are intentionally not modeled, even when technically feasible.",
    icon: "/assets/svgs/3.svg",
  },
  {
    title: "Evaluation-Gated Model Behavior",
    description: "Model outputs are continuously evaluated against predefined alignment and safety criteria during development.",
    icon: "/assets/svgs/4.svg",
  },
  {
    title: "Restricted Interface Exposure",
    description: "Production systems expose limited control surfaces, preventing misuse through parameter or latent access.",
    icon: "/assets/svgs/5.svg",
  },
  {
    title: "Deployment-Aware Research Design",
    description: "Research systems are built with real-world deployment constraints, not unconstrained demo objectives.",
    icon: "/assets/svgs/5.svg",
  },
];

export default function Ethics() {
  return (
    <section className="bg-[#f5f1e3] pt-12 pb-6 sm:pt-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row gap-8 sm:gap-12 lg:gap-16 items-start mb-12 sm:mb-16 lg:mb-24">
          {/* Left Content */}
          <div className="lg:w-1/3">
            <p className="font-label text-xs tracking-widest text-[#133333] uppercase mb-4">
              Ethics
            </p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-normal text-[#133333] leading-tight mb-8">
              Our principles <br className="hidden sm:inline" /> for research
            </h2>
            <Link
              href="#"
              className="inline-flex items-center justify-center rounded-md bg-[#133333] px-6 py-3 text-sm font-medium text-white shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#133333] font-label"
            >
              Contact Us
            </Link>
          </div>

          {/* Right Content - Grid */}
          <div className="lg:w-2/3 rounded-xl p-4 sm:p-6 relative overflow-hidden min-h-[400px] sm:min-h-[500px] lg:min-h-[600px]">
            <Image
              src="/assets/images/benefits.jpg"
              alt=""
              fill
              className="object-cover rounded-xl"
              sizes="(max-width: 1024px) 100vw, 66vw"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 relative z-10">
              {benefits.map((benefit, index) => (
                <div key={index} className="bg-white rounded-xl p-6 sm:p-8 flex flex-col h-full min-h-[220px] sm:min-h-[260px]">
                  <div className="mb-6">
                    <Image
                      src={benefit.icon}
                      alt=""
                      width={20}
                      height={20}
                      className="w-5 h-5"
                    />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-serif font-normal text-[#133333] mb-3 sm:mb-4">
                      {benefit.title}
                  </h3>
                  <p className="font-label text-[#133333]/70 text-sm leading-relaxed">
                      {benefit.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

