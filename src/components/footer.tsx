import { Link } from "@tanstack/react-router"
import { ShoppingBag } from "lucide-react"
import { footerData } from "../../asset/assets"

const Footer = () => {
  return (
    <div className="mt-3 min-h-60 bg-primary px-2 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl py-10">
        {/* top */}
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
          {/* brand */}
          <div>
            <Link to="/" className="mb-4 flex items-center gap-2">
              <ShoppingBag className="size-6" />
              <span className="text-xl font-semibold">
                Super<span className="text-slate-100/30">shop</span>
              </span>
            </Link>
            <p className="text-white/70">
              Lorem ipsum dolor sit amet consectetur adipisicing elit. Incidunt
              ullam hic assumenda nihil quos veniam,
            </p>
            <div className="mt-4 flex gap-3">
              {footerData.brand.socials.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={social.label}
                  className="rounded-full bg-white/10 p-2 transition-colors hover:bg-white/20"
                >
                  <social.icon className="size-4" />
                </a>
              ))}
            </div>
          </div>
          {/* dummy data */}
          {footerData.sections.map((section, index) => (
            <div key={index}>
              <h3 className="mb-4 text-sm font-semibold uppercase">
                {section.title}
              </h3>
              <ul className="space-y-2.5">
                {section.links.map((link, linkIndex) => (
                  <li key={linkIndex}>
                    {link.to ? (
                      <Link
                        to={link.to}
                        className="text-sm text-white/70 hover:text-white"
                      >
                        {link.label}
                      </Link>
                    ) : (
                      <a
                        href={link.href}
                        className="text-sm text-white/70 hover:text-white"
                      >
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* contact */}
          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase">Contact us</h3>
            <ul className="space-y-3">
              {footerData.contact.map((item, index) => {
                const Icon = item.icon
                return (
                  <li
                    key={index}
                    className="flex items-center gap-3 text-sm text-white/70"
                  >
                    <Icon className="size-4 text-white" />
                    {item.text}
                  </li>
                )
              })}
            </ul>
          </div>
        </div>

        {/* bottom */}
        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 sm:flex-row">
          <p className="text-xs text-white/50">{footerData.bottom.copyright}</p>
          <div className="flex gap-2">
            {footerData.bottom.links.map((link, index) => (
              <a
                key={index}
                href={link.href}
                className="text-xs text-white/50 hover:text-white/70"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Footer
