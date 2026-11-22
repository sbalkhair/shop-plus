import { heroSectionData } from "../../../../asset/assets"

const Features = () => {
  return (
    <section className="rounded-xl border bg-white py-5">
      <div className="mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {heroSectionData.hero_features.map((feature, index) => (
            <div key={index} className="flex items-center gap-3 py-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-orange-100">
                <feature.icon className="size-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-primary">
                  {feature.title}
                </p>
                <p className="text-xs text-muted-foreground">{feature.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default Features
