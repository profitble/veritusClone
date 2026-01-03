import Image from 'next/image'

export default function Hero() {
  return (
    <>
      <div className="bg-[#f5f1e3] flex flex-col justify-center relative overflow-hidden pt-12 pb-20 sm:pb-24 lg:pb-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="mx-auto max-w-4xl text-center">
            <p className="text-xs font-medium tracking-[0.2em] text-[#133333] uppercase mb-6 font-sans">
              Introducing Argon Labs
            </p>
            <h1 className="font-serif text-5xl font-normal tracking-tight text-[#133333] sm:text-6xl md:text-7xl leading-[1.06]">
              <span className="italic">solving</span> multimodal
              <br />
              video intelligence
            </h1>
            <p className="mt-7 text-lg leading-8 text-[#133333]/80 max-w-2xl mx-auto font-label">
             Researching multimodal generation systems focused
              <br className="hidden sm:inline" />
              on temporal coherence and identity stability.
            </p>
            
            <div className="mt-12 flex justify-center px-4 sm:px-0">
              <form className="relative flex w-full max-w-lg items-center">
                <label htmlFor="email-address" className="sr-only">
                  Email address
                </label>
                <div className="relative flex w-full flex-col sm:flex-row rounded-lg shadow-sm bg-white p-1.5 gap-2 sm:gap-0">
                  <input
                    type="email"
                    name="email-address"
                    id="email-address"
                    autoComplete="email"
                    required
                    className="block w-full border-0 bg-transparent py-3 pl-4 text-gray-900 placeholder:text-gray-400 focus:ring-0 text-sm sm:text-sm sm:leading-6 focus:outline-none font-label"
                    placeholder="Email"
                  />
                  <button
                    type="submit"
                    className="flex-none rounded-md bg-[#133333] px-4 py-3 text-sm sm:px-6 sm:text-base font-semibold text-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#133333] min-h-[44px] font-label whitespace-nowrap w-full sm:w-auto"
                  >
                    Contact Us
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
      <div className="w-full">
        <Image
          src="/assets/images/hero.png"
          alt="Hero"
          width={1920}
          height={1080}
          className="w-full h-auto"
          priority
        />
      </div>
    </>
  )
}

