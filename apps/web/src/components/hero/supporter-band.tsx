const PARTNERS = [
  { name: "UKG", src: "/assets/partners/ukg.svg" },
  { name: "ServiceNow", src: "/assets/partners/servicenow.svg" },
  { name: "Datadog", src: "/assets/partners/datadog.svg" },
  { name: "NVIDIA", src: "/assets/partners/nvidia.svg" },
];

/**
 * Enough repeats that half the track still fills the lane on a wide monitor,
 * which is what keeps the loop from running out of logos.
 */
const COPIES = 8;

function PartnerLogo({ name, src, hidden }: { name: string; src: string; hidden?: boolean }) {
  return (
    <div
      role="img"
      aria-label={hidden ? undefined : name}
      aria-hidden={hidden}
      className={`mr-12 h-7 w-32 flex-none bg-neutral-partner-navy mask-contain mask-center mask-no-repeat motion-reduce:mr-0 ${
        hidden ? "motion-reduce:hidden" : ""
      }`}
      style={{ maskImage: `url(${src})`, WebkitMaskImage: `url(${src})` }}
    />
  );
}

export function SupporterBand() {
  return (
    <section
      aria-label="Supported by"
      className="relative flex items-stretch border-t border-gold/22"
    >
      <span className="z-10 flex flex-none items-center border-r border-gold/22 bg-navy px-6 py-4 type-label whitespace-nowrap text-neutral-muted-navy">
        Supported by
      </span>
      <div className="flex min-w-0 flex-1 items-center overflow-hidden py-4 pl-12 motion-reduce:pl-0">
        <div className="flex w-max animate-marquee items-center hover:[animation-play-state:paused] motion-reduce:w-full motion-reduce:justify-evenly">
          {Array.from({ length: COPIES }, (_, copy) =>
            PARTNERS.map((partner) => (
              <PartnerLogo key={`${copy} ${partner.name}`} {...partner} hidden={copy > 0} />
            )),
          )}
        </div>
      </div>
    </section>
  );
}
