import { useEffect, useState } from 'react';

// Custom Positivus Vector Illustrations
const PositivusLogo = () => (
  <svg className="logo-icon" viewBox="0 0 36 36" fill="currentColor">
    <path d="M18 0L22.5 13.5L36 18L22.5 22.5L18 36L13.5 22.5L0 18L13.5 13.5L18 0Z" />
  </svg>
);

const HeroIllustration = () => (
  <svg viewBox="0 0 600 500" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="50" y="80" width="380" height="340" rx="30" fill="#191A23" />
    <path d="M140 180L240 110L340 180V320H140V180Z" fill="#B9FF66" stroke="#191A23" strokeWidth="4" />
    <circle cx="240" cy="220" r="45" fill="#191A23" />
    <path d="M220 220L235 235L265 205" stroke="#B9FF66" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M380 200L520 120L500 360L380 280V200Z" fill="#F3F3F3" stroke="#191A23" strokeWidth="4" />
    <circle cx="450" cy="240" r="30" fill="#B9FF66" stroke="#191A23" strokeWidth="4" />
    <path d="M90 340C140 380 220 400 300 370" stroke="#191A23" strokeWidth="8" strokeLinecap="round" />
    <polygon points="420,70 440,110 400,100" fill="#B9FF66" stroke="#191A23" strokeWidth="3" />
    <polygon points="100,60 120,90 80,90" fill="#191A23" />
  </svg>
);

const LoupeIllustration = () => (
  <svg viewBox="0 0 200 170" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="90" cy="80" r="55" fill="#B9FF66" stroke="#191A23" strokeWidth="4" />
    <path d="M130 120L170 160" stroke="#191A23" strokeWidth="12" strokeLinecap="round" />
    <path d="M65 80H115" stroke="#191A23" strokeWidth="5" strokeLinecap="round" />
    <path d="M90 55V105" stroke="#191A23" strokeWidth="5" strokeLinecap="round" />
  </svg>
);

const ClickAdIllustration = () => (
  <svg viewBox="0 0 200 170" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="30" y="30" width="140" height="100" rx="16" fill="#FFFFFF" stroke="#191A23" strokeWidth="4" />
    <path d="M60 60H140" stroke="#191A23" strokeWidth="6" strokeLinecap="round" />
    <path d="M60 85H110" stroke="#191A23" strokeWidth="6" strokeLinecap="round" />
    <path d="M110 90L145 145L130 150L115 125L95 135L110 90Z" fill="#191A23" />
  </svg>
);

const SocialIllustration = () => (
  <svg viewBox="0 0 200 170" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M30 40H170V120H90L50 150V120H30V40Z" fill="#FFFFFF" stroke="#191A23" strokeWidth="4" />
    <circle cx="75" cy="80" r="12" fill="#B9FF66" stroke="#191A23" strokeWidth="3" />
    <circle cx="100" cy="80" r="12" fill="#191A23" />
    <circle cx="125" cy="80" r="12" fill="#B9FF66" stroke="#191A23" strokeWidth="3" />
  </svg>
);

const EmailIllustration = () => (
  <svg viewBox="0 0 200 170" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="25" y="40" width="150" height="95" rx="12" fill="#B9FF66" stroke="#191A23" strokeWidth="4" />
    <path d="M25 45L100 95L175 45" stroke="#191A23" strokeWidth="4" strokeLinejoin="round" />
    <path d="M140 20L170 35L140 50Z" fill="#191A23" />
  </svg>
);

const ContentIllustration = () => (
  <svg viewBox="0 0 200 170" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="30" y="25" width="140" height="120" rx="14" fill="#FFFFFF" stroke="#191A23" strokeWidth="4" />
    <rect x="45" y="45" width="50" height="40" rx="6" fill="#B9FF66" stroke="#191A23" strokeWidth="3" />
    <path d="M110 50H155" stroke="#191A23" strokeWidth="4" strokeLinecap="round" />
    <path d="M110 70H145" stroke="#191A23" strokeWidth="4" strokeLinecap="round" />
    <path d="M45 105H155" stroke="#191A23" strokeWidth="4" strokeLinecap="round" />
    <path d="M45 125H125" stroke="#191A23" strokeWidth="4" strokeLinecap="round" />
  </svg>
);

const AnalyticsIllustration = () => (
  <svg viewBox="0 0 200 170" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="30" y="30" width="140" height="110" rx="14" fill="#B9FF66" stroke="#191A23" strokeWidth="4" />
    <rect x="50" y="80" width="20" height="45" fill="#191A23" />
    <rect x="80" y="60" width="20" height="65" fill="#FFFFFF" stroke="#191A23" strokeWidth="3" />
    <rect x="110" y="45" width="20" height="80" fill="#191A23" />
    <path d="M45 70L85 50L115 35L145 20" stroke="#191A23" strokeWidth="4" strokeLinecap="round" strokeDasharray="4 4" />
  </svg>
);

const ProposalIllustration = () => (
  <svg viewBox="0 0 360 300" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="180" cy="150" r="110" fill="#B9FF66" stroke="#191A23" strokeWidth="4" />
    <path d="M110 170L150 90L230 110L250 190L190 230L110 170Z" fill="#191A23" />
    <path d="M140 120L210 140" stroke="#B9FF66" strokeWidth="5" strokeLinecap="round" />
    <path d="M150 150L200 165" stroke="#B9FF66" strokeWidth="5" strokeLinecap="round" />
    <circle cx="270" cy="80" r="25" fill="#FFFFFF" stroke="#191A23" strokeWidth="3" />
    <polygon points="270,65 277,80 292,80 280,89 284,103 270,93 256,103 260,89 248,80 263,80" fill="#191A23" />
  </svg>
);

const ContactIllustration = () => (
  <svg viewBox="0 0 450 400" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="50" y="60" width="350" height="280" rx="30" fill="#191A23" />
    <path d="M120 120L225 210L330 120" stroke="#B9FF66" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="360" cy="80" r="45" fill="#B9FF66" stroke="#191A23" strokeWidth="4" />
    <path d="M345 80H375" stroke="#191A23" strokeWidth="6" strokeLinecap="round" />
    <path d="M360 65V95" stroke="#191A23" strokeWidth="6" strokeLinecap="round" />
  </svg>
);

const UserAvatar = ({ seed }: { seed: number }) => (
  <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="40" cy="40" r="38" fill={seed % 2 === 0 ? '#B9FF66' : '#F3F3F3'} stroke="#191A23" strokeWidth="3" />
    <circle cx="40" cy="30" r="16" fill="#191A23" />
    <path d="M16 68C16 54 26 48 40 48C54 48 64 54 64 68" fill="#191A23" />
  </svg>
);

export default function App() {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [activeProcess, setActiveProcess] = useState<number>(0);
  const [testimonialIndex, setTestimonialIndex] = useState<number>(0);
  const [contactType, setContactType] = useState<'hi' | 'quote'>('hi');
  const [caseFilter, setCaseFilter] = useState<'all' | 'ecom' | 'saas' | 'local'>('all');
  const [toast, setToast] = useState<string>('');

  // Live Demo Dashboard State
  const [demoTab, setDemoTab] = useState<'seo' | 'ppc' | 'social' | 'revenue'>('seo');

  // ROI Calculator State
  const [adSpend, setAdSpend] = useState<number>(15000);
  const [convRate, setConvRate] = useState<number>(3.5);

  // Proposal Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState(1);
  const [selectedServices, setSelectedServices] = useState<string[]>(['SEO', 'PPC']);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  };

  useEffect(() => {
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = (window.scrollY / totalHeight) * 100;
      setScrollProgress(progress);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleServiceChoice = (svc: string) => {
    setSelectedServices(prev =>
      prev.includes(svc) ? prev.filter(s => s !== svc) : [...prev, svc]
    );
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    showToast('Thank you! Your message has been sent successfully.');
  };

  const processSteps = [
    {
      num: '01',
      title: 'Consultation',
      desc: 'During the initial consultation, we will discuss your business goals and objectives, target audience, and current marketing efforts. This will allow us to understand your needs and tailor our services to your specific requirements.'
    },
    {
      num: '02',
      title: 'Research and Strategy Development',
      desc: 'We perform in-depth market research, competitor analysis, and audience segmentation to craft a tailored digital marketing strategy designed for maximum ROI.'
    },
    {
      num: '03',
      title: 'Implementation',
      desc: 'Our expert team executes campaigns across chosen channels, from setting up PPC ads and optimizing site code to launching content schedules.'
    },
    {
      num: '04',
      title: 'Monitoring and Optimization',
      desc: 'We continuously monitor campaign metrics in real-time, performing A/B testing and performance tweaks to maximize conversion rates.'
    },
    {
      num: '05',
      title: 'Reporting and Communication',
      desc: 'Receive detailed monthly transparent reports detailing key performance indicators, traffic growth, and campaign return on investment.'
    },
    {
      num: '06',
      title: 'Continual Improvement',
      desc: 'Digital marketing never stops. We continuously refine strategies based on data trends, consumer behavior changes, and new growth opportunities.'
    }
  ];

  const teamMembers = [
    {
      name: 'John Smith',
      role: 'CEO and Founder',
      bio: '10+ years of experience in digital marketing. Expertise in SEO, PPC, and content strategy.'
    },
    {
      name: 'Jane Doe',
      role: 'Director of Operations',
      bio: '7+ years of experience in project management and team leadership. Proven track record in scaling operations.'
    },
    {
      name: 'Michael Brown',
      role: 'Senior SEO Specialist',
      bio: '5+ years of experience in SEO and content creation. Proficient in keyword research and technical audit.'
    },
    {
      name: 'Emily Johnson',
      role: 'PPC Manager',
      bio: '3+ years of experience in paid search advertising. Skilled in Google Ads campaign setup and budget optimization.'
    },
    {
      name: 'Brian Williams',
      role: 'Social Media Specialist',
      bio: '4+ years of experience in social media marketing. Proficient in content creation and audience engagement.'
    },
    {
      name: 'Sarah Kim',
      role: 'Content Creator',
      bio: '2+ years of experience in writing and editing. Skilled in creating compelling blog posts and high-converting web copy.'
    }
  ];

  const testimonials = [
    {
      quote: '"We have been working with Positivus for the past year and have seen a significant increase in our website traffic and leads. Their team is professional, responsive, and truly cares about the success of our business. We highly recommend Positivus to any company looking to grow their online presence."',
      author: 'John Smith',
      role: 'Marketing Director at XYZ Corp'
    },
    {
      quote: '"Positivus completely transformed our PPC strategy. Within 90 days, our cost-per-acquisition dropped by 38% while conversions doubled. They are by far the best agency partner we have worked with."',
      author: 'Sarah Jenkins',
      role: 'Founder of Apex Retail'
    },
    {
      quote: '"Their SEO audit revealed technical bottlenecks that held our organic traffic back for years. After implementing their fixes, we achieved page 1 rankings for 14 high-value keywords within 4 months."',
      author: 'Marcus Vance',
      role: 'Head of Growth at CloudScale'
    }
  ];

  // Dynamic Calculations for ROI Calculator
  const projectedRevenue = Math.round(adSpend * (convRate * 1.8));
  const roiMultiplier = (projectedRevenue / adSpend).toFixed(1);
  const estimatedLeads = Math.round((adSpend / 45) * (convRate / 2));

  return (
    <>
      {/* Top Scroll Progress Indicator */}
      <div className="scroll-progress-bar" style={{ width: `${scrollProgress}%` }} />

      {/* Header */}
      <header className="site-header">
        <div className="container">
          <nav className="nav-wrapper">
            <a href="#" className="logo">
              <PositivusLogo />
              <span>Positivus</span>
            </a>
            <ul className="nav-links">
              <li><a href="#about">About us</a></li>
              <li><a href="#services">Services</a></li>
              <li><a href="#demo">Live Demo</a></li>
              <li><a href="#calculator">ROI Calculator</a></li>
              <li><a href="#cases">Use Cases</a></li>
              <li><a href="#process">Working Process</a></li>
              <li><a href="#team">Team</a></li>
              <li>
                <button className="btn btn-secondary" style={{ padding: '12px 24px' }} onClick={() => setIsModalOpen(true)}>
                  Request a quote
                </button>
              </li>
            </ul>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="hero" id="about">
          <div className="container">
            <div className="investor-badge">
              <span className="status-dot-live" />
              <span>Investor Pitch & Startup Platform Demo • Series A Ready</span>
            </div>
            <div className="hero-grid">
              <div className="hero-content">
                <h1>Navigating the digital landscape for success</h1>
                <p>
                  Our digital marketing agency helps businesses grow and succeed online through a range of services including SEO, PPC, social media marketing, and content creation.
                </p>
                <div className="hero-cta-group">
                  <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
                    Book a consultation
                  </button>
                  <a href="#calculator" className="btn btn-secondary">
                    Calculate ROI ↗
                  </a>
                </div>
              </div>
              <div className="hero-illustration">
                <HeroIllustration />
              </div>
            </div>
          </div>
        </section>

        {/* Stats Counter Bar (Investor Proof) */}
        <section className="stats-banner">
          <div className="container">
            <div className="stats-grid">
              <div className="stat-box">
                <div className="stat-value">$45M+</div>
                <div className="stat-label">Client Revenue Generated</div>
              </div>
              <div className="stat-box">
                <div className="stat-value">98.4%</div>
                <div className="stat-label">Client Retention Rate</div>
              </div>
              <div className="stat-box">
                <div className="stat-value">340+</div>
                <div className="stat-label">Global Campaigns Launched</div>
              </div>
              <div className="stat-box">
                <div className="stat-value">4.9/5</div>
                <div className="stat-label">Average Client Rating</div>
              </div>
            </div>
          </div>
        </section>

        {/* Social Proof Logos Bar */}
        <section className="logos-bar">
          <div className="container">
            <div className="logos-flex">
              <div className="logo-item">amazon</div>
              <div className="logo-item">searchmind</div>
              <div className="logo-item">HubSpot</div>
              <div className="logo-item">Notion</div>
              <div className="logo-item">NETFLIX</div>
              <div className="logo-item">zoom</div>
            </div>
          </div>
        </section>

        {/* Services Section */}
        <section className="services-section" id="services">
          <div className="container">
            <div className="section-header">
              <span className="section-title">Services</span>
              <p className="section-desc">
                At our digital marketing agency, we offer a range of services to help businesses grow and succeed online. These include:
              </p>
            </div>

            <div className="services-grid">
              {/* Card 1 */}
              <div className="service-card card-light">
                <div className="card-left">
                  <div>
                    <span className="card-title-badge badge-lime">Search engine</span>
                    <span className="card-title-badge badge-lime">optimization</span>
                  </div>
                  <div className="card-link" onClick={() => setIsModalOpen(true)}>
                    <span className="icon-btn btn-icon-black">↗</span>
                    <span>Learn more</span>
                  </div>
                </div>
                <div className="card-right">
                  <LoupeIllustration />
                </div>
              </div>

              {/* Card 2 */}
              <div className="service-card card-lime">
                <div className="card-left">
                  <div>
                    <span className="card-title-badge badge-white">Pay-per-click</span>
                    <span className="card-title-badge badge-white">advertising</span>
                  </div>
                  <div className="card-link" onClick={() => setIsModalOpen(true)}>
                    <span className="icon-btn btn-icon-black">↗</span>
                    <span>Learn more</span>
                  </div>
                </div>
                <div className="card-right">
                  <ClickAdIllustration />
                </div>
              </div>

              {/* Card 3 */}
              <div className="service-card card-dark">
                <div className="card-left">
                  <div>
                    <span className="card-title-badge badge-white">Social Media</span>
                    <span className="card-title-badge badge-white">Marketing</span>
                  </div>
                  <div className="card-link" onClick={() => setIsModalOpen(true)}>
                    <span className="icon-btn btn-icon-white">↗</span>
                    <span style={{ color: '#FFF' }}>Learn more</span>
                  </div>
                </div>
                <div className="card-right">
                  <SocialIllustration />
                </div>
              </div>

              {/* Card 4 */}
              <div className="service-card card-light">
                <div className="card-left">
                  <div>
                    <span className="card-title-badge badge-lime">Email</span>
                    <span className="card-title-badge badge-lime">Marketing</span>
                  </div>
                  <div className="card-link" onClick={() => setIsModalOpen(true)}>
                    <span className="icon-btn btn-icon-black">↗</span>
                    <span>Learn more</span>
                  </div>
                </div>
                <div className="card-right">
                  <EmailIllustration />
                </div>
              </div>

              {/* Card 5 */}
              <div className="service-card card-lime">
                <div className="card-left">
                  <div>
                    <span className="card-title-badge badge-white">Content</span>
                    <span className="card-title-badge badge-white">Creation</span>
                  </div>
                  <div className="card-link" onClick={() => setIsModalOpen(true)}>
                    <span className="icon-btn btn-icon-black">↗</span>
                    <span>Learn more</span>
                  </div>
                </div>
                <div className="card-right">
                  <ContentIllustration />
                </div>
              </div>

              {/* Card 6 */}
              <div className="service-card card-dark">
                <div className="card-left">
                  <div>
                    <span className="card-title-badge badge-lime">Analytics and</span>
                    <span className="card-title-badge badge-lime">Tracking</span>
                  </div>
                  <div className="card-link" onClick={() => setIsModalOpen(true)}>
                    <span className="icon-btn btn-icon-white">↗</span>
                    <span style={{ color: '#FFF' }}>Learn more</span>
                  </div>
                </div>
                <div className="card-right">
                  <AnalyticsIllustration />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Live Interactive Campaign Dashboard (Investor Feature) */}
        <section className="demo-section" id="demo">
          <div className="container">
            <div className="section-header">
              <span className="section-title">Live Campaign Engine</span>
              <p className="section-desc">
                Interactive real-time attribution and performance analytics tracking engine built for high-growth enterprises.
              </p>
            </div>

            <div className="demo-container">
              <div className="demo-header-tabs">
                <button
                  className={`tab-btn ${demoTab === 'seo' ? 'active' : ''}`}
                  onClick={() => setDemoTab('seo')}
                >
                  🔍 Organic SEO Traffic
                </button>
                <button
                  className={`tab-btn ${demoTab === 'ppc' ? 'active' : ''}`}
                  onClick={() => setDemoTab('ppc')}
                >
                  ⚡ PPC Conversion Rate
                </button>
                <button
                  className={`tab-btn ${demoTab === 'social' ? 'active' : ''}`}
                  onClick={() => setDemoTab('social')}
                >
                  💬 Social Engagement
                </button>
                <button
                  className={`tab-btn ${demoTab === 'revenue' ? 'active' : ''}`}
                  onClick={() => setDemoTab('revenue')}
                >
                  💰 Revenue Attribution
                </button>
              </div>

              <div className="demo-dashboard-preview">
                <div className="chart-panel">
                  <div className="chart-panel-header">
                    <div>
                      <span style={{ color: '#a0a0a0', fontSize: '0.9rem' }}>Current Quarter Metrics</span>
                      <div className="chart-metric-value">
                        {demoTab === 'seo' && '485,200 Organic Visits'}
                        {demoTab === 'ppc' && '8.4% Conv. Rate (+4.2%)'}
                        {demoTab === 'social' && '1.2M Total Impressions'}
                        {demoTab === 'revenue' && '$1,480,000 Pipeline Value'}
                      </div>
                    </div>
                    <span className="status-dot-live" />
                  </div>

                  <div className="chart-bars">
                    {[
                      { month: 'Jan', val: demoTab === 'seo' ? 40 : demoTab === 'ppc' ? 30 : demoTab === 'social' ? 50 : 35 },
                      { month: 'Feb', val: demoTab === 'seo' ? 55 : demoTab === 'ppc' ? 45 : demoTab === 'social' ? 65 : 50 },
                      { month: 'Mar', val: demoTab === 'seo' ? 70 : demoTab === 'ppc' ? 60 : demoTab === 'social' ? 80 : 65 },
                      { month: 'Apr', val: demoTab === 'seo' ? 85 : demoTab === 'ppc' ? 78 : demoTab === 'social' ? 90 : 80 },
                      { month: 'May', val: demoTab === 'seo' ? 100 : demoTab === 'ppc' ? 95 : demoTab === 'social' ? 98 : 96 },
                    ].map((item) => (
                      <div key={item.month} className="bar-col">
                        <div className="bar-fill" style={{ height: `${item.val}%` }} />
                        <span className="bar-label">{item.month}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="insights-panel">
                  <div className="insight-card">
                    <h5>Average CPA Reduction</h5>
                    <strong>-42.5%</strong>
                  </div>
                  <div className="insight-card">
                    <h5>Monthly Qualified Leads</h5>
                    <strong>+1,420 / mo</strong>
                  </div>
                  <div className="insight-card">
                    <h5>Campaign Health Score</h5>
                    <strong style={{ color: 'var(--clr-primary)' }}>99.2 / 100</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Interactive Growth & ROI Calculator */}
        <section className="calculator-section" id="calculator">
          <div className="container">
            <div className="section-header">
              <span className="section-title">Growth & ROI Calculator</span>
              <p className="section-desc">
                Simulate your projected revenue expansion and ROI boost using Positivus data models.
              </p>
            </div>

            <div className="calculator-card">
              <div className="calc-inputs">
                <div className="range-slider-group">
                  <div className="range-header">
                    <span>Monthly Ad Spend ($)</span>
                    <span>${adSpend.toLocaleString()}</span>
                  </div>
                  <input
                    type="range"
                    min="5000"
                    max="100000"
                    step="5000"
                    value={adSpend}
                    onChange={(e) => setAdSpend(Number(e.target.value))}
                  />
                </div>

                <div className="range-slider-group">
                  <div className="range-header">
                    <span>Target Conversion Rate (%)</span>
                    <span>{convRate}%</span>
                  </div>
                  <input
                    type="range"
                    min="1.0"
                    max="10.0"
                    step="0.5"
                    value={convRate}
                    onChange={(e) => setConvRate(Number(e.target.value))}
                  />
                </div>

                <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
                  Request Strategy Proposal
                </button>
              </div>

              <div className="calc-results-box">
                <span className="res-title">Projected Annual Revenue Expansion</span>
                <div className="res-big-number">${(projectedRevenue * 12).toLocaleString()}</div>
                <div className="res-grid-sub">
                  <div className="res-sub-item">
                    <span>Estimated ROI Multiplier</span>
                    <strong>{roiMultiplier}x ROI</strong>
                  </div>
                  <div className="res-sub-item">
                    <span>Monthly Qualified Leads</span>
                    <strong>+{estimatedLeads} Leads</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Proposal Banner */}
        <section className="cta-proposal">
          <div className="container">
            <div className="proposal-card">
              <div className="proposal-content">
                <h3>Let's make things happen</h3>
                <p>
                  Contact us today to learn more about how our digital marketing services can help your business grow and succeed online.
                </p>
                <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
                  Get your free proposal
                </button>
              </div>
              <div className="proposal-image">
                <ProposalIllustration />
              </div>
            </div>
          </div>
        </section>

        {/* Case Studies Section */}
        <section className="case-studies-section" id="cases">
          <div className="container">
            <div className="section-header">
              <span className="section-title">Case Studies</span>
              <p className="section-desc">
                Explore Real-Life Examples of Our Proven Digital Marketing Success through Our Case Studies.
              </p>
            </div>

            <div className="filter-pills">
              <button
                className={`filter-pill ${caseFilter === 'all' ? 'active' : ''}`}
                onClick={() => setCaseFilter('all')}
              >
                All Industries
              </button>
              <button
                className={`filter-pill ${caseFilter === 'local' ? 'active' : ''}`}
                onClick={() => setCaseFilter('local')}
              >
                Local Business
              </button>
              <button
                className={`filter-pill ${caseFilter === 'saas' ? 'active' : ''}`}
                onClick={() => setCaseFilter('saas')}
              >
                B2B SaaS
              </button>
              <button
                className={`filter-pill ${caseFilter === 'ecom' ? 'active' : ''}`}
                onClick={() => setCaseFilter('ecom')}
              >
                E-Commerce
              </button>
            </div>

            <div className="case-studies-card">
              {(caseFilter === 'all' || caseFilter === 'local') && (
                <div className="case-item">
                  <p>
                    For a local restaurant, we implemented a targeted PPC campaign that resulted in a 300% increase in website traffic and a 45% increase in sales.
                  </p>
                  <div className="case-link" onClick={() => setIsModalOpen(true)}>
                    <span>Learn more</span>
                    <span>↗</span>
                  </div>
                </div>
              )}

              {(caseFilter === 'all' || caseFilter === 'saas') && (
                <div className="case-item">
                  <p>
                    For a B2B software company, we developed an SEO strategy that increased organic traffic by 200% and generated 500+ qualified leads per month.
                  </p>
                  <div className="case-link" onClick={() => setIsModalOpen(true)}>
                    <span>Learn more</span>
                    <span>↗</span>
                  </div>
                </div>
              )}

              {(caseFilter === 'all' || caseFilter === 'ecom') && (
                <div className="case-item">
                  <p>
                    For a national retail chain, we created a social media marketing campaign that increased followers by 50% and boosted online sales by 25%.
                  </p>
                  <div className="case-link" onClick={() => setIsModalOpen(true)}>
                    <span>Learn more</span>
                    <span>↗</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Our Working Process Section */}
        <section className="process-section" id="process">
          <div className="container">
            <div className="section-header">
              <span className="section-title">Our Working Process</span>
              <p className="section-desc">
                Step-by-Step Guide to Achieving Your Business Goals
              </p>
            </div>

            <div className="process-list">
              {processSteps.map((step, idx) => {
                const isExpanded = activeProcess === idx;
                return (
                  <div
                    key={step.num}
                    className={`process-item ${isExpanded ? 'expanded' : 'collapsed'}`}
                    onClick={() => setActiveProcess(isExpanded ? -1 : idx)}
                  >
                    <div className="process-header">
                      <div className="process-title-group">
                        <span className="process-num">{step.num}</span>
                        <span className="process-name">{step.title}</span>
                      </div>
                      <div className="toggle-btn">
                        {isExpanded ? '-' : '+'}
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="process-body">
                        {step.desc}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Team Section */}
        <section className="team-section" id="team">
          <div className="container">
            <div className="section-header">
              <span className="section-title">Team</span>
              <p className="section-desc">
                Meet the skilled and experienced team behind our successful digital marketing strategies
              </p>
            </div>

            <div className="team-grid">
              {teamMembers.map((member, idx) => (
                <div key={member.name} className="team-card">
                  <div className="team-card-header">
                    <div className="member-info-flex">
                      <div className="avatar-wrapper">
                        <UserAvatar seed={idx} />
                      </div>
                      <div className="member-details">
                        <h4>{member.name}</h4>
                        <p>{member.role}</p>
                      </div>
                    </div>
                    <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="linkedin-btn">
                      in
                    </a>
                  </div>
                  <hr className="team-divider" />
                  <p className="member-bio">{member.bio}</p>
                </div>
              ))}
            </div>

            <div className="team-cta">
              <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
                See all team
              </button>
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section className="testimonials-section" id="testimonials">
          <div className="container">
            <div className="section-header">
              <span className="section-title">Testimonials</span>
              <p className="section-desc">
                Hear from Our Satisfied Clients: Read Our Testimonials to Learn More About Our Digital Marketing Services
              </p>
            </div>

            <div className="testimonials-card-container">
              <div className="testimonials-slider">
                {testimonials.map((item, idx) => (
                  <div key={idx} className="testimonial-item">
                    <div className="bubble">
                      {item.quote}
                    </div>
                    <div className="author-info">
                      <div className="author-name">{item.author}</div>
                      <div className="author-role">{item.role}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="slider-controls">
                <button
                  className="slider-nav-btn"
                  onClick={() => setTestimonialIndex((prev) => (prev > 0 ? prev - 1 : testimonials.length - 1))}
                >
                  ←
                </button>
                <div className="slider-dots">
                  {testimonials.map((_, idx) => (
                    <span
                      key={idx}
                      className={`dot ${idx === testimonialIndex ? 'active' : ''}`}
                      onClick={() => setTestimonialIndex(idx)}
                    />
                  ))}
                </div>
                <button
                  className="slider-nav-btn"
                  onClick={() => setTestimonialIndex((prev) => (prev < testimonials.length - 1 ? prev + 1 : 0))}
                >
                  →
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Contact Us Section */}
        <section className="contact-section" id="contact">
          <div className="container">
            <div className="section-header">
              <span className="section-title">Contact Us</span>
              <p className="section-desc">
                Connect with Us: Let's Discuss Your Digital Marketing Needs
              </p>
            </div>

            <div className="contact-card">
              <form className="contact-form" onSubmit={handleFormSubmit}>
                <div className="radio-group">
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="contactType"
                      value="hi"
                      checked={contactType === 'hi'}
                      onChange={() => setContactType('hi')}
                    />
                    <span>Say Hi</span>
                  </label>
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="contactType"
                      value="quote"
                      checked={contactType === 'quote'}
                      onChange={() => setContactType('quote')}
                    />
                    <span>Get a Quote</span>
                  </label>
                </div>

                <div className="form-group">
                  <label htmlFor="name">Name</label>
                  <input id="name" type="text" placeholder="Name" required />
                </div>

                <div className="form-group">
                  <label htmlFor="email">Email*</label>
                  <input id="email" type="email" placeholder="Email" required />
                </div>

                <div className="form-group">
                  <label htmlFor="message">Message*</label>
                  <textarea id="message" rows={4} placeholder="Message" required />
                </div>

                <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }}>
                  Send Message
                </button>
              </form>

              <div className="contact-illustration">
                <ContactIllustration />
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Interactive Multi-Step Proposal Modal (Investor Pitch Feature) */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <button className="close-modal-btn" onClick={() => setIsModalOpen(false)}>
              ×
            </button>

            <div style={{ marginBottom: 20 }}>
              <span className="contact-badge">Instant Proposal Generator</span>
              <h3 style={{ fontSize: '1.8rem', fontWeight: 600, marginTop: 10 }}>
                {modalStep === 1 && 'Step 1: Select Required Growth Channels'}
                {modalStep === 2 && 'Step 2: Estimate Monthly Ad Budget'}
                {modalStep === 3 && 'Step 3: Instant Proposal Ready'}
              </h3>
            </div>

            <div className="modal-step-indicator">
              <div className={`step-pill ${modalStep >= 1 ? 'active' : ''}`} />
              <div className={`step-pill ${modalStep >= 2 ? 'active' : ''}`} />
              <div className={`step-pill ${modalStep >= 3 ? 'active' : ''}`} />
            </div>

            {modalStep === 1 && (
              <div>
                <p style={{ color: '#555', fontSize: '1.05rem' }}>
                  Select the services your company needs for acceleration:
                </p>
                <div className="service-checkbox-grid">
                  {['SEO', 'PPC Advertising', 'Social Media', 'Email Marketing', 'Content Creation', 'Analytics'].map((svc) => (
                    <div
                      key={svc}
                      className={`checkbox-chip ${selectedServices.includes(svc) ? 'selected' : ''}`}
                      onClick={() => toggleServiceChoice(svc)}
                    >
                      <input
                        type="checkbox"
                        checked={selectedServices.includes(svc)}
                        readOnly
                      />
                      <span>{svc}</span>
                    </div>
                  ))}
                </div>
                <button
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: 20 }}
                  onClick={() => setModalStep(2)}
                >
                  Continue to Budgeting →
                </button>
              </div>
            )}

            {modalStep === 2 && (
              <div>
                <p style={{ color: '#555', fontSize: '1.05rem', marginBottom: 20 }}>
                  What is your target monthly advertising budget?
                </p>
                <div className="range-slider-group" style={{ marginBottom: 30 }}>
                  <div className="range-header">
                    <span>Target Budget</span>
                    <span>${adSpend.toLocaleString()} / mo</span>
                  </div>
                  <input
                    type="range"
                    min="5000"
                    max="100000"
                    step="5000"
                    value={adSpend}
                    onChange={(e) => setAdSpend(Number(e.target.value))}
                  />
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setModalStep(1)}>
                    ← Back
                  </button>
                  <button className="btn btn-primary" style={{ flex: 2 }} onClick={() => setModalStep(3)}>
                    Generate Proposal →
                  </button>
                </div>
              </div>
            )}

            {modalStep === 3 && (
              <div>
                <div style={{ backgroundColor: 'var(--clr-gray)', padding: 24, borderRadius: 20, marginBottom: 24, border: '1px solid var(--clr-dark)' }}>
                  <h4 style={{ fontSize: '1.2rem', marginBottom: 12 }}>Custom Strategy Estimate Summary</h4>
                  <p style={{ fontSize: '0.95rem', color: '#444' }}>
                    <strong>Selected Channels:</strong> {selectedServices.join(', ')}
                  </p>
                  <p style={{ fontSize: '0.95rem', color: '#444', marginTop: 6 }}>
                    <strong>Target Budget:</strong> ${adSpend.toLocaleString()} / mo
                  </p>
                  <p style={{ fontSize: '1.1rem', color: 'var(--clr-dark)', fontWeight: 600, marginTop: 12 }}>
                    Projected Revenue Expansion: ${(projectedRevenue * 12).toLocaleString()} / yr
                  </p>
                </div>
                <form onSubmit={(e) => { e.preventDefault(); setIsModalOpen(false); showToast('Proposal sent to your email!'); }}>
                  <div className="form-group" style={{ marginBottom: 16 }}>
                    <label>Work Email</label>
                    <input type="email" placeholder="ceo@company.com" required />
                  </div>
                  <button type="submit" className="btn btn-lime" style={{ width: '100%' }}>
                    Claim Custom Proposal Package 🚀
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="site-footer">
        <div className="container">
          <div className="footer-card">
            <div className="footer-top">
              <a href="#" className="logo footer-logo">
                <PositivusLogo />
                <span>Positivus</span>
              </a>
              <ul className="footer-nav">
                <li><a href="#about">About us</a></li>
                <li><a href="#services">Services</a></li>
                <li><a href="#demo">Live Demo</a></li>
                <li><a href="#calculator">ROI Calculator</a></li>
                <li><a href="#cases">Use Cases</a></li>
                <li><a href="#process">Working Process</a></li>
                <li><a href="#team">Team</a></li>
              </ul>
              <div className="social-links">
                <a href="#" className="social-icon">in</a>
                <a href="#" className="social-icon">f</a>
                <a href="#" className="social-icon">X</a>
              </div>
            </div>

            <div className="footer-middle">
              <div className="contact-info">
                <span className="contact-badge">Contact us:</span>
                <p>Email: info@positivus.com</p>
                <p>Phone: 555-567-8901</p>
                <p>Address: 1234 Main St, Moonstone City, St 4567</p>
              </div>

              <form className="newsletter-box" onSubmit={(e) => { e.preventDefault(); showToast('Subscribed to newsletter!'); }}>
                <input type="email" placeholder="Email" required />
                <button type="submit" className="btn btn-lime">
                  Subscribe to news
                </button>
              </form>
            </div>

            <div className="footer-bottom">
              <div>© 2026 Positivus. All Rights Reserved.</div>
              <div><a href="#">Privacy Policy</a></div>
            </div>
          </div>
        </div>
      </footer>

      {/* Toast Notification */}
      {toast && <div className="toast-msg">{toast}</div>}
    </>
  );
}
