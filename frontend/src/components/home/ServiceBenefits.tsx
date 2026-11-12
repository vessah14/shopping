import { Icon } from "../ui/Brand";

const benefits = [
  { icon: "truck" as const, title: "LIVRAISON", text: "Disponible au Cameroun" },
  { icon: "lock" as const, title: "PAIEMENT", text: "Modalités à confirmer avec l’équipe" },
  { icon: "medal" as const, title: "SÉLECTION", text: "Mode, beauté et cheveux" },
  { icon: "headphones" as const, title: "CONSEIL", text: "Échange direct sur WhatsApp" },
];

export default function ServiceBenefits() {
  return (
    <section className="service-benefits" id="services" aria-label="Nos services">
      {benefits.map((benefit, index) => (
        <article className="benefit" key={benefit.title}>
          <span className="benefit-number">0{index + 1}</span>
          <Icon name={benefit.icon} />
          <div><h2>{benefit.title}</h2><p>{benefit.text}</p></div>
        </article>
      ))}
    </section>
  );
}
