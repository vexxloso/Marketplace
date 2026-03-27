import Link from "next/link";
import TypingHeroTitle from "./TypingHeroTitle";

const topProviders = [
  "Horizon Realty Group",
  "PrimeNest Properties",
  "Landmark Living Realty",
  "BlueSky Estates",
  "Urban Peak Realty",
];

const bestPlaces = [
  "Carrickreagh Houseboat",
  "MIKO II. Micro Cabin for Two",
  "The Gothic Room at Chateau Trebesice",
  "Intimate Private Pool Villas",
  "Vineyard Cottage",
];

const guestFavorites = [
  {
    title: "The Gothic Room at Chateau Trebesice",
    provider: "Landmark Living Realty",
    price: "198",
    image: "/review-suite.jpg",
  },
  {
    title: "Private Castle Only for You",
    provider: "Landmark Living Realty",
    price: "2000",
    image: "/service-entrance.jpg",
  },
  {
    title: "MIKO II. Micro Cabin for Two",
    provider: "PrimeNest Properties",
    price: "120",
    image: "/listing-interior.jpg",
  },
  {
    title: "King's Rock Cabin 1",
    provider: "PrimeNest Properties",
    price: "150",
    image: "/hero-villa.jpg",
  },
];

const categories = [
  { title: "Historical homes", image: "/service-entrance.jpg" },
  { title: "Beachfront", image: "/hero-villa.jpg" },
  { title: "Amazing views", image: "/review-suite.jpg" },
  { title: "Lake", image: "/listing-interior.jpg" },
];

const newestPlaces = [
  {
    title: "Room in Toulon",
    provider: "Horizon Realty Group",
    price: "50",
    image: "/service-entrance.jpg",
  },
  {
    title: "Carrickreagh Houseboat",
    provider: "Horizon Realty Group",
    price: "254",
    image: "/hero-villa.jpg",
  },
  {
    title: "MIKO II. Micro Cabin for Two",
    provider: "PrimeNest Properties",
    price: "120",
    image: "/listing-interior.jpg",
  },
  {
    title: "King's Rock Cabin 1",
    provider: "PrimeNest Properties",
    price: "150",
    image: "/review-suite.jpg",
  },
  {
    title: "The Gothic Room at Chateau Trebesice",
    provider: "Landmark Living Realty",
    price: "198",
    image: "/auth-lobby.jpg",
  },
  {
    title: "Private Pool Villa Retreat",
    provider: "BlueSky Estates",
    price: "320",
    image: "/hero-villa.jpg",
  },
];

const resources = [
  {
    tag: "Rental Tips",
    title: "The Ultimate Guide to Finding Your Perfect Rental",
    description:
      "Learn how to compare stay styles, amenities, locations, and hidden costs before you book.",
  },
  {
    tag: "Short-Term",
    title: "Short-Term vs. Long-Term Rentals: What's Best for Your Needs?",
    description:
      "Explore how trip length, flexibility, and comfort expectations should shape where you stay.",
  },
  {
    tag: "Hidden Costs",
    title: "Hidden Costs of Renting: What You Need to Know Before Signing",
    description:
      "A quick guide to fees, service charges, and pricing details guests should always review.",
  },
];

export default function HomePage() {
  return (
    <main className="container home-page">
      <section className="market-hero">
        <div className="market-hero-main">
          <p className="eyebrow">Maison Noir marketplace</p>
          <TypingHeroTitle />
          <p className="subtitle hero-subtitle">
            Find places to stay with atmosphere, confidence, and richer hospitality signals from the first glance.
          </p>

          <div className="market-search-shell">
            <div className="market-search-label">Search</div>
            <div className="market-search-row">
              <span>Discover premium stays, cabins, villas, and memorable escapes</span>
              <Link href="/listings" className="hero-primary">
                Search
              </Link>
            </div>
          </div>

          <div className="market-service-strip">
            <article className="market-mini-card">
              <strong>Enhanced visibility</strong>
              <span>Discover standout spaces from providers with clearer presentation and stronger trust signals.</span>
            </article>
            <article className="market-mini-card">
              <strong>Effortless management</strong>
              <span>Guests and hosts can handle browsing, booking, and communication in one polished flow.</span>
            </article>
            <article className="market-mini-card">
              <strong>Trust and transparency</strong>
              <span>Ratings, reviews, pricing detail, and host communication stay visible throughout the journey.</span>
            </article>
          </div>
        </div>

        <aside className="market-hero-side">
          <div className="market-list-card">
            <h3>Top providers</h3>
            <ul className="market-link-list">
              {topProviders.map((provider) => (
                <li key={provider}>{provider}</li>
              ))}
            </ul>
          </div>

          <div className="market-list-card">
            <h3>Best places</h3>
            <ul className="market-link-list">
              {bestPlaces.map((place) => (
                <li key={place}>{place}</li>
              ))}
            </ul>
          </div>
        </aside>
      </section>

      <section className="market-section">
        <div className="market-section-head">
          <div>
            <p className="eyebrow">Guest favorites</p>
            <h2>The most popular places on the platform.</h2>
          </div>
          <Link href="/listings" className="hero-inline-link">
            Explore all stays
          </Link>
        </div>

        <div className="market-card-grid">
          {guestFavorites.map((place) => (
            <article key={place.title} className="market-place-card">
              <img src={place.image} alt={place.title} className="market-place-image" />
              <div className="market-place-body">
                <p className="market-place-provider">by {place.provider}</p>
                <h3>{place.title}</h3>
                <div className="market-place-foot">
                  <span>{place.price} USD / night</span>
                  <Link href="/listings" className="market-inline-link">
                    Preview
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="market-section market-categories">
        <div className="market-section-head">
          <div>
            <p className="eyebrow">Popular categories</p>
            <h2>Get specific with your favorite amenities.</h2>
          </div>
        </div>
        <div className="market-category-grid">
          {categories.map((category) => (
            <article key={category.title} className="market-category-card">
              <img src={category.image} alt={category.title} className="market-category-image" />
              <div className="market-category-overlay">
                <p>{category.title}</p>
                <Link href="/listings" className="market-inline-link">
                  Learn more
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="market-section market-latest">
        <div className="market-section-head">
          <div>
            <p className="eyebrow">Newest real estate</p>
            <h2>Explore the latest places in trending categories.</h2>
          </div>
          <div className="market-filter-pills">
            <span className="market-pill active">All category</span>
            <span className="market-pill">Lake</span>
            <span className="market-pill">Amazing views</span>
            <span className="market-pill">Beachfront</span>
            <span className="market-pill">Historical homes</span>
          </div>
        </div>

        <div className="market-card-grid market-card-grid-large">
          {newestPlaces.map((place) => (
            <article key={place.title} className="market-place-card">
              <img src={place.image} alt={place.title} className="market-place-image" />
              <div className="market-place-body">
                <p className="market-place-provider">by {place.provider}</p>
                <h3>{place.title}</h3>
                <div className="market-place-foot">
                  <span>{place.price} USD / night</span>
                  <Link href="/listings" className="market-inline-link">
                    Preview
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="market-section-cta">
          <Link href="/listings" className="hero-secondary">
            View all real estate
          </Link>
        </div>
      </section>

      <section className="market-section market-resources">
        <div className="market-section-head">
          <div>
            <p className="eyebrow">Useful resources</p>
            <h2>Explore some of our most popular content and learn something new.</h2>
          </div>
        </div>

        <div className="market-resource-grid">
          {resources.map((resource) => (
            <article key={resource.title} className="market-resource-card">
              <span className="market-resource-tag">{resource.tag}</span>
              <h3>{resource.title}</h3>
              <p>{resource.description}</p>
              <Link href="/listings" className="market-inline-link">
                Read more
              </Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
