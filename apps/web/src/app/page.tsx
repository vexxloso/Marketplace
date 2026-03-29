import Link from "next/link";

import { publicUrl } from "../lib/base-path";
import HomeV2Slider from "./HomeV2Slider";
import Reveal from "./Reveal";
import { EthosIconManagement, EthosIconTrust, EthosIconVisibility } from "./HomeEthosIcons";

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
    image: publicUrl("/home-visual-1.jpg"),
  },
  {
    title: "Private Castle Only for You",
    provider: "Landmark Living Realty",
    price: "2000",
    image: publicUrl("/home-visual-2.jpg"),
  },
  {
    title: "MIKO II. Micro Cabin for Two",
    provider: "PrimeNest Properties",
    price: "120",
    image: publicUrl("/home-visual-3.jpg"),
  },
  {
    title: "King's Rock Cabin 1",
    provider: "PrimeNest Properties",
    price: "150",
    image: publicUrl("/home-visual-4.jpg"),
  },
];

const categories = [
  { title: "Historical homes", image: publicUrl("/home-visual-5.jpg") },
  { title: "Beachfront", image: publicUrl("/home-visual-6.jpg") },
  { title: "Amazing views", image: publicUrl("/home-visual-1.jpg") },
  { title: "Lake", image: publicUrl("/home-visual-2.jpg") },
];

const newestPlaces = [
  {
    title: "Room in Toulon",
    provider: "Horizon Realty Group",
    price: "50",
    image: publicUrl("/home-visual-2.jpg"),
  },
  {
    title: "Carrickreagh Houseboat",
    provider: "Horizon Realty Group",
    price: "254",
    image: publicUrl("/home-visual-5.jpg"),
  },
  {
    title: "MIKO II. Micro Cabin for Two",
    provider: "PrimeNest Properties",
    price: "120",
    image: publicUrl("/home-visual-3.jpg"),
  },
  {
    title: "King's Rock Cabin 1",
    provider: "PrimeNest Properties",
    price: "150",
    image: publicUrl("/home-visual-4.jpg"),
  },
  {
    title: "The Gothic Room at Chateau Trebesice",
    provider: "Landmark Living Realty",
    price: "198",
    image: publicUrl("/home-visual-6.jpg"),
  },
  {
    title: "Private Pool Villa Retreat",
    provider: "BlueSky Estates",
    price: "320",
    image: publicUrl("/home-visual-1.jpg"),
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
    <main className="home-v2">
      <section className="home-v2-hero home-v2-hero--editorial">
        <div className="home-v2-hero-bg" aria-hidden>
          <img
            src={publicUrl("/home-hero-bg.jpg")}
            alt=""
            className="home-v2-hero-bg-img"
            decoding="async"
            fetchPriority="high"
          />
        </div>
        <div className="home-v2-hero-overlay">
          <div className="home-v2-hero-copy home-v2-hero-copy--editorial">
            <h1 className="home-v2-hero-brandline home-v2-hero-fade">
              Find places to stay on Maison Noir
            </h1>
            <p className="home-v2-hero-tagline home-v2-hero-fade home-v2-hero-fade--delay">
              Experience the world with unwavering comfort, consistency, and convenience.
            </p>
          </div>
          <Link
            href="/listings"
            className="home-v2-hero-search-pill home-v2-hero-fade home-v2-hero-fade--search"
            aria-label="Search listings: open browse and filters"
          >
            <span className="home-v2-hero-search-pill-text">
              What real estate do you want to rent?
            </span>
            <span className="home-v2-hero-search-fab" aria-hidden>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="M16.5 16.5 21 21"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </Link>
        </div>
      </section>

      <section className="container home-v2-container home-v2-container--ethos-overlap">
        <Reveal className="home-v2-ethos home-v2-ethos--light">
          <div className="home-v2-ethos-item">
            <div className="home-v2-ethos-icon" aria-hidden>
              <EthosIconVisibility />
            </div>
            <h3>Enhanced visibility</h3>
            <p>
              A rental marketplace connects property owners with a large pool of potential tenants,
              increasing visibility for the right match.
            </p>
          </div>
          <div className="home-v2-ethos-item">
            <div className="home-v2-ethos-icon" aria-hidden>
              <EthosIconManagement />
            </div>
            <h3>Effortless management</h3>
            <p>
              Renters and landlords can easily handle listings, bookings, and payments online,
              streamlining the rental process.
            </p>
          </div>
          <div className="home-v2-ethos-item">
            <div className="home-v2-ethos-icon" aria-hidden>
              <EthosIconTrust />
            </div>
            <h3>Trust and transparency</h3>
            <p>
              Ratings, reviews, and detailed property information build trust and provide transparency
              for all involved.
            </p>
          </div>
        </Reveal>
      </section>

      <section className="container home-v2-container">
        <Reveal className="home-v2-editorial-lists">
          <div className="home-v2-list-col">
            <h3>Top providers</h3>
            <ul>
              {topProviders.map((provider) => (
                <li key={provider}>{provider}</li>
              ))}
            </ul>
          </div>
          <div className="home-v2-list-col">
            <h3>Best places</h3>
            <ul>
              {bestPlaces.map((place) => (
                <li key={place}>{place}</li>
              ))}
            </ul>
          </div>
        </Reveal>
      </section>

      <section className="container home-v2-container home-v2-container--favorites">
        <Reveal>
          <div className="home-v2-reveal-segment">
            <div className="home-v2-section-head">
              <div>
                <p className="eyebrow">Guest favorites</p>
                <h2 className="home-v2-section-title">The most popular places on the platform.</h2>
              </div>
              <Link href="/listings" className="home-v2-text-link">
                Explore all stays
              </Link>
            </div>
          </div>

          <div className="home-v2-reveal-segment">
          <HomeV2Slider variant="favorites">
            {guestFavorites.map((place) => (
              <Link key={place.title} href="/listings" className="home-v2-stay">
                <div className="home-v2-stay-figure">
                  <img src={place.image} alt="" className="home-v2-stay-img" />
                </div>
                <p className="home-v2-stay-provider">{place.provider}</p>
                <h3 className="home-v2-stay-title">{place.title}</h3>
                <p className="home-v2-stay-price">
                  {place.price} USD <span className="home-v2-stay-price-unit">/ night</span>
                </p>
              </Link>
            ))}
          </HomeV2Slider>
          </div>
        </Reveal>
      </section>

      <section className="container home-v2-container home-v2-container--categories">
        <Reveal>
          <div className="home-v2-reveal-segment">
            <div className="home-v2-section-head home-v2-section-head--solo">
              <div>
                <p className="eyebrow">Popular categories</p>
                <h2 className="home-v2-section-title">Get specific with your favorite amenities.</h2>
              </div>
            </div>
          </div>
          <div className="home-v2-reveal-segment">
          <HomeV2Slider variant="categories">
            {categories.map((category) => (
              <Link key={category.title} href="/listings" className="home-v2-cat">
                <img src={category.image} alt="" className="home-v2-cat-img" />
                <div className="home-v2-cat-label">
                  <span>{category.title}</span>
                </div>
              </Link>
            ))}
          </HomeV2Slider>
          </div>
        </Reveal>
      </section>

      <section className="container home-v2-container home-v2-container--latest">
        <Reveal>
          <div className="home-v2-reveal-segment">
            <div className="home-v2-section-head home-v2-section-head--solo">
              <div>
                <p className="eyebrow">Newest real estate</p>
                <h2 className="home-v2-section-title">Explore the latest places in trending categories.</h2>
              </div>
            </div>
          </div>

          <div className="home-v2-reveal-segment">
          <div className="home-v2-stay-grid home-v2-stay-grid--three">
            {newestPlaces.map((place) => (
              <Link key={place.title} href="/listings" className="home-v2-stay">
                <div className="home-v2-stay-figure home-v2-stay-figure--tall">
                  <img src={place.image} alt="" className="home-v2-stay-img" />
                </div>
                <p className="home-v2-stay-provider">{place.provider}</p>
                <h3 className="home-v2-stay-title">{place.title}</h3>
                <p className="home-v2-stay-price">
                  {place.price} USD <span className="home-v2-stay-price-unit">/ night</span>
                </p>
              </Link>
            ))}
          </div>
          </div>

          <div className="home-v2-reveal-segment">
          <div className="home-v2-cta-row">
            <Link href="/listings" className="home-v2-ghost-btn">
              View all real estate
            </Link>
          </div>
          </div>
        </Reveal>
      </section>

      <section className="container home-v2-container home-v2-container--journal">
        <Reveal>
          <div className="home-v2-reveal-segment">
            <div className="home-v2-section-head home-v2-section-head--solo">
              <div>
                <p className="eyebrow">Useful resources</p>
                <h2 className="home-v2-section-title">
                  Popular reads before you book your next stay.
                </h2>
              </div>
            </div>
          </div>

          <div className="home-v2-journal">
            {resources.map((resource) => (
              <article key={resource.title} className="home-v2-journal-row">
                <span className="home-v2-journal-tag">{resource.tag}</span>
                <div className="home-v2-journal-body">
                  <h3>{resource.title}</h3>
                  <p>{resource.description}</p>
                </div>
                <Link href="/listings" className="home-v2-text-link home-v2-text-link--small">
                  Read
                </Link>
              </article>
            ))}
          </div>
        </Reveal>
      </section>
    </main>
  );
}
