export default function AboutSection() {
  return (
    <section className="about-section" id="apropos">
      <div className="about-image" role="img" aria-label="Emplacement réservé à la future photo de la boutique">
        <div className="about-image-placeholder">
          <span className="about-image-mark" aria-hidden="true">✦</span>
          <span>ESPACE SHOPPING PLUS</span>
          <small>Votre photo de boutique viendra ici</small>
        </div>
      </div>
      <div className="about-copy">
        <p className="eyebrow">UNE BOUTIQUE CAMEROUNAISE</p>
        <h2>Le style d’ici, à votre image.</h2>
        <p>Mode, beauté et cheveux : Espace Shopping Plus réunit au Cameroun des pièces et des essentiels choisis pour accompagner votre quotidien. Découvrez la sélection et écrivez-nous pour vérifier la disponibilité.</p>
        <a className="text-link" href="/boutique">Voir les articles <span aria-hidden="true">→</span></a>
      </div>
    </section>
  );
}
