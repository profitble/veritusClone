import Image from 'next/image'

export default function Features() {
  const features = [
    {
      title: 'Video Generation',
      description: 'Neural architectures for high-fidelity video synthesis with long-range temporal coherence, motion consistency, and control.',
      image: '/assets/images/leftFeature.jpg',
      icon: '/assets/svgs/funnel.svg'
    },
    {
      title: 'Multimodal Representation Learning',
      description: 'Learning unified representations across vision, audio, and language to enable robust video understanding and cross-modal reasoning.',
      image: '/assets/images/midFeature.jpg',
      icon: '/assets/svgs/clock.svg'
    },
    {
      title: 'Temporal Modeling & Control',
      description: 'Modeling time, dynamics, and causality in video to support structured generation, editing, and semantic control.',
      image: '/assets/images/rightFeature.jpg',
      icon: '/assets/svgs/stock.svg'
    }
  ]

  return (
    <div id="features" className="bg-[#f5f1e3] pt-24 pb-12 sm:py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center mb-12">
          <h2 className="text-4xl font-serif font-normal text-[#133333] sm:text-5xl mb-8">
           Our primary <span className="italic">research</span> domains
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-6 md:gap-8 md:grid-cols-3">
          {features.map((feature, index) => (
            <div key={index} className="bg-white rounded-lg overflow-hidden flex flex-col h-full">
              <div className="h-64 relative">
                <Image
                  src={feature.image}
                  alt={feature.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                />
                <div className="absolute top-6 left-6 z-10 w-20 h-20 bg-white/30 backdrop-blur-md rounded-xl flex items-center justify-center">
                  <Image
                    src={feature.icon}
                    alt=""
                    width={32}
                    height={32}
                    className="w-8 h-8"
                  />
                </div>
              </div>
              <div className="p-6 md:p-8 flex-1 flex flex-col">
                <h3 className="text-3xl font-serif font-normal text-[#133333] mb-6 leading-[1.1]">
                  {feature.title}
                </h3>
                <p className="text-[#133333]/70 leading-relaxed font-label text-base">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

