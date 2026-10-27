// Beehive eligibility form — source. Built by build.mjs into:
//   dist/webflow-embed.html  (paste into a Webflow Code Embed, EMBED = true)
//   dist/index.html          (standalone page for the existing iframe, EMBED = false)
//
// Class names, DOM structure, copy, HubSpot payload and tracking events are
// kept identical to legacy/original.html — test/parity.mjs checks this.

const { useState, useEffect, useMemo, useCallback, useRef } = React;

// ============================================================================
// Icons (Iconoir) — only the two the form renders
// ============================================================================
const svgProps = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', width: '18', height: '18' };
const Ico = {
  arrowRight: () => (
    <svg {...svgProps} strokeWidth="1.5" strokeLinejoin="round"><path d="M15 6L21 12L15 18" /><path d="M21 12H3" /></svg>
  ),
  check: () => (
    <svg {...svgProps} strokeWidth="1.8" strokeLinejoin="round"><path d="M5 13L9 17L19 7" /></svg>
  ),
};

// ============================================================================
// Sectors + industries. Industry values (sent to HubSpot) are derived from the
// label: "Apparel & Fashion" -> "APPAREL_FASHION". Order is display order.
// ============================================================================
const SECTORS = [
  { value: 'trading', label: 'Trading', sublabel: 'Buy and sell goods' },
  { value: 'services', label: 'Services', sublabel: 'Sell expertise or labour' },
  { value: 'manufacturing', label: 'Manufacturing', sublabel: 'Make or produce goods' },
];
const INDUSTRY_LABELS = {
  trading: 'Apparel & Fashion|Automotive|Building Materials|Business Supplies and Equipment|Consumer Electronics|Consumer Goods|Cosmetics|Dairy|Food & Beverages|Furniture|Import and Export|Luxury Goods & Jewelry|Retail|Sporting Goods|Supermarkets|Tobacco|Wholesale|Wine and Spirits',
  services: 'Accounting|Airlines/Aviation|Alternative Dispute Resolution|Alternative Medicine|Animation|Architecture & Planning|Arts and Crafts|Banking|Broadcast Media|Capital Markets|Civic & Social Organization|Commercial Real Estate|Computer & Network Security|Computer Networking|Computer Software|Internet|Consumer Services|Design|Education Management|E-Learning|Entertainment|Environmental Services|Events Services|Executive Office|Facilities Services|Financial Services|Fine Art|Fund-Raising|Gambling & Casinos|Government Administration|Government Relations|Graphic Design|Health, Wellness and Fitness|Higher Education|Hospital & Health Care|Hospitality|Human Resources|Individual & Family Services|Information Services|Information Technology and Services|Insurance|International Affairs|International Trade and Development|Investment Banking|Investment Management|Judiciary|Law Enforcement|Law Practice|Legal Services|Legislative Office|Leisure, Travel & Tourism|Libraries|Logistics and Supply Chain|Management Consulting|Maritime|Market Research|Marketing and Advertising|Media Production|Medical Practice|Mental Health Care|Military|Motion Pictures and Film|Museums and Institutions|Music|Newspapers|Non-Profit Organization Management|Online Media|Outsourcing/Offshoring|Package/Freight Delivery|Performing Arts|Philanthropy|Photography|Political Organization|Primary/Secondary Education|Professional Training & Coaching|Program Development|Public Policy|Public Relations and Communications|Public Safety|Publishing|Real Estate|Recreational Facilities and Services|Religious Institutions|Research|Restaurants|Security and Investigations|Sports|Staffing and Recruiting|Telecommunications|Think Tanks|Translation and Localization|Transportation/Trucking/Railroad|Utilities|Venture Capital & Private Equity|Veterinary|Warehousing|Wireless|Writing and Editing|Computer Games|Mobile Games',
  manufacturing: 'Aviation & Aerospace|Biotechnology|Chemicals|Civil Engineering|Computer Hardware|Construction|Defense & Space|Electrical/Electronic Manufacturing|Farming|Fishery|Food Production|Glass, Ceramics & Concrete|Industrial Automation|Machinery|Mechanical or Industrial Engineering|Medical Devices|Mining & Metals|Nanotechnology|Oil & Energy|Packaging and Containers|Paper & Forest Products|Pharmaceuticals|Plastics|Printing|Railroad Manufacture|Ranching|Renewables & Environment|Semiconductors|Shipbuilding|Textiles',
};
const INDUSTRIES = Object.entries(INDUSTRY_LABELS).flatMap(([sector, labels]) =>
  labels.split('|').map((label) => ({ value: label.toUpperCase().replace(/[^A-Z0-9]+/g, '_'), label, sector })));
const labelForSector = (v) => (SECTORS.find((s) => s.value === v) || {}).label || '';

// ============================================================================
// Controls
// ============================================================================
const OptionGroup = ({ options, value, onChange, onAutoAdvance }) => {
  const handleClick = (val) => {
    onChange(val);
    // Small delay so user sees the selection feedback before advancing
    setTimeout(() => onAutoAdvance(), 280);
  };
  return (
    <div className="options ">
      {options.map((o) => (
        <button key={o.value} type="button" className={`opt ${value === o.value ? 'selected' : ''}`} onClick={() => handleClick(o.value)}>
          <span className="opt-label">{o.label}</span>
        </button>
      ))}
    </div>
  );
};

const Slider = ({ value, onChange, min, max, prefix, caption, format, formatBound, scale, step }) => {
  const clampedValue = Math.max(min, Math.min(max, value));
  const pct = scale ? (scale.toPos(clampedValue) / scale.maxPos) * 100 : ((clampedValue - min) / (max - min)) * 100;
  return (
    <div className="slider-wrap">
      <div className="slider-value">
        <span className="slider-value-prefix">{prefix}</span>
        {format(clampedValue)}
      </div>
      <div className="slider-caption">{caption}</div>
      <input
        type="range"
        min={scale ? 0 : min}
        max={scale ? scale.maxPos : max}
        step={scale ? 1 : step}
        value={scale ? scale.toPos(clampedValue) : clampedValue}
        onChange={(e) => onChange(scale ? scale.fromPos(Number(e.target.value)) : Number(e.target.value))}
      />
      <div className="slider-track-fill" style={{ width: `calc(${pct}% - ${pct * 0.28}px)` }} />
      <div className="slider-bounds">
        <span>{formatBound(min)}</span>
        <span>{formatBound(max)}</span>
      </div>
    </div>
  );
};

const TextField = ({ label, value, onChange, placeholder, type = 'text', error, autoFocus, inputMode }) => (
  <div className="field">
    <label className="field-label">{label}</label>
    <input type={type} inputMode={inputMode} className={`input ${error ? 'error' : ''}`} value={value}
      onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoFocus={autoFocus} />
    {error && <div className="input-error">{error}</div>}
  </div>
);

const PhoneField = ({ label, codeValue, codeOptions, numberValue, onCodeChange, onNumberChange, error, maxDigits }) => (
  <div className="field">
    <label className="field-label">{label}</label>
    <div className="phone-row">
      <select className="input" value={codeValue} onChange={(e) => onCodeChange(e.target.value)} style={{ paddingRight: 8, appearance: 'none' }}>
        {codeOptions.map((c) => <option key={c.value} value={c.value} style={{ color: '#000' }}>{c.label}</option>)}
      </select>
      <input
        type="tel"
        inputMode="tel"
        className={`input ${error ? 'error' : ''}`}
        value={numberValue}
        onChange={(e) => {
          const digitsOnly = e.target.value.replace(/[^0-9 ]/g, '');
          if (maxDigits && digitsOnly.replace(/\s/g, '').length > maxDigits) return;
          onNumberChange(digitsOnly);
        }}
        placeholder="50 123 4567"
      />
    </div>
    {error && <div className="input-error">{error}</div>}
  </div>
);

// Big tappable trigger + searchable sheet. Used for the long industry list.
const Combobox = ({ value, onChange, options, placeholder, triggerLabel }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
    document.body.classList.toggle('combo-open', open);
    return () => document.body.classList.remove('combo-open');
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [query, options]);

  return (
    <div className="combobox">
      <button type="button" className={`combo-trigger ${selected ? 'has-value' : ''}`} onClick={() => setOpen(true)}>
        <span className="combo-trigger-label">{selected ? selected.label : triggerLabel}</span>
        <svg {...svgProps} strokeWidth="1.6"><path d="M6 9l6 6 6-6" /></svg>
      </button>

      {open && (
        <div className="combo-overlay" onClick={() => setOpen(false)}>
          <div className="combo-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="combo-search-row">
              <svg {...svgProps} strokeWidth="1.6"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
              <input ref={inputRef} type="text" className="combo-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={placeholder} />
              <button type="button" className="combo-close" onClick={() => setOpen(false)} aria-label="Close">
                <svg {...svgProps} strokeWidth="1.8"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>
            <div className="combo-list">
              {filtered.length === 0 && <div className="combo-empty">No matches. Try a different keyword.</div>}
              {filtered.map((o) => (
                <button key={o.value} type="button" className={`combo-item ${value === o.value ? 'selected' : ''}`}
                  onClick={() => { onChange(o.value); setOpen(false); setQuery(''); }}>
                  <span>{o.label}</span>
                  {value === o.value && <Ico.check />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Steps
// ============================================================================
const formatAED = (v) => {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(v % 1_000_000 === 0 ? 0 : 1) + 'M';
  if (v >= 1_000) return (v / 1_000).toFixed(0) + 'K';
  return String(v);
};
const aed = (v) => `AED ${formatAED(v)}`;

const Eyebrow = ({ children }) => <div className="eyebrow"><span className="eyebrow-dot" />{children}</div>;

const StepAge = ({ data, set, next }) => (
  <>
    <Eyebrow>About your business</Eyebrow>
    <h1 className="q-title">How long has your business been operating?</h1>
    <p className="q-sub">Pick the range that fits. We'll get to specifics later.</p>
    <OptionGroup
      onAutoAdvance={() => {
        trackEvent('form_step_complete', { step: 'age', step_label: STEP_LABELS.age });
        next();
      }}
      value={data.businessAge}
      onChange={(v) => set({ businessAge: v })}
      options={[
        { value: '<6', label: 'Under 6 months' },
        { value: '6-12', label: '6 to 12 months' },
        { value: '1-2', label: '1 to 2 years' },
        { value: '2+', label: 'Over 2 years' },
      ]}
    />
  </>
);

const StepSectorIndustry = ({ data, set }) => {
  const industriesForSector = useMemo(() => INDUSTRIES.filter((i) => i.sector === data.sector), [data.sector]);
  const sectorName = labelForSector(data.sector).toLowerCase();
  return (
    <>
      <Eyebrow>Sector</Eyebrow>
      <h1 className="q-title">What kind of business do you run?</h1>
      <p className="q-sub">Pick a sector first, then choose your specific industry.</p>
      <div className="options" style={{ marginBottom: 18 }}>
        {SECTORS.map((s) => (
          <button key={s.value} type="button" className={`opt ${data.sector === s.value ? 'selected' : ''}`}
            onClick={() => s.value !== data.sector && set({ sector: s.value, industry: '' })}>
            <span className="opt-label">{s.label}<div className="opt-sub">{s.sublabel}</div></span>
            <span className="opt-check" aria-hidden></span>
          </button>
        ))}
      </div>
      {data.sector && (
        <div className="industry-picker">
          <label className="field-label" style={{ marginBottom: 6, display: 'block' }}>Your industry</label>
          <Combobox
            value={data.industry}
            onChange={(v) => set({ industry: v })}
            options={industriesForSector}
            placeholder={`Search ${sectorName} industries...`}
            triggerLabel={`Choose a ${sectorName} industry`}
          />
        </div>
      )}
    </>
  );
};

// Revenue slider is piecewise: 50K steps to 2M, 250K steps to 10M, 1M steps to 50M.
const REVENUE_MAX = 50_000_000;
const revenueScale = {
  maxPos: 112,
  toPos: (v) => v <= 2_000_000 ? Math.round(v / 50_000)
    : v <= 10_000_000 ? 40 + Math.round((v - 2_000_000) / 250_000)
    : 72 + Math.round((v - 10_000_000) / 1_000_000),
  fromPos: (p) => p <= 40 ? p * 50_000
    : p <= 72 ? 2_000_000 + (p - 40) * 250_000
    : 10_000_000 + (p - 72) * 1_000_000,
};

const StepRevenue = ({ data, set }) => (
  <>
    <Eyebrow>Trading volume</Eyebrow>
    <h1 className="q-title">What is your average annual revenue?</h1>
    <p className="q-sub">A rough figure is fine. Drag the slider to your typical year.</p>
    <Slider
      min={0}
      max={REVENUE_MAX}
      value={data.revenue}
      onChange={(v) => set({ revenue: v, revenueTouched: true })}
      scale={revenueScale}
      prefix="AED "
      format={(v) => v >= REVENUE_MAX ? `${formatAED(v)}+` : formatAED(v)}
      formatBound={(v) => v === REVENUE_MAX ? `${aed(v)}+` : aed(v)}
      caption="Drag to set your annual revenue"
    />
    <div className="chips">
      {[2_000_000, 5_000_000, 10_000_000, 25_000_000, 50_000_000].map((v) => (
        <button key={v} type="button" className={`chip ${data.revenueTouched && data.revenue === v ? 'active' : ''}`}
          onClick={() => set({ revenue: v, revenueTouched: true })}>{`${aed(v)}${v === REVENUE_MAX ? '+' : ''}`}</button>
      ))}
    </div>
  </>
);

const LOAN_CAP = 2_000_000;
const StepLoan = ({ data, set }) => (
  <>
    <Eyebrow>Funding goal</Eyebrow>
    <h1 className="q-title">How much funding do you need?</h1>
    <p className="q-sub">{`Beehive funds eligible businesses up to ${aed(LOAN_CAP)}.`}</p>
    <Slider
      min={50_000}
      max={LOAN_CAP}
      step={25_000}
      value={Math.min(data.loanAmount, LOAN_CAP)}
      onChange={(v) => set({ loanAmount: v, loanTouched: true })}
      prefix="AED "
      format={formatAED}
      formatBound={aed}
      caption={`Most Beehive loans land between ${aed(100_000)} and ${aed(1_000_000)}`}
    />
  </>
);

const PHONE_CODES = [
  { value: '+971', label: '🇦🇪 +971' },
  { value: '+968', label: '🇴🇲 +968' },
  { value: '+966', label: '🇸🇦 +966' },
];
// Country-specific mobile number lengths (digits, excluding country code)
const PHONE_MAX_DIGITS = { '+971': 9, '+968': 8, '+966': 9 };

const StepContact = ({ data, set, errors }) => (
  <>
    <Eyebrow>Almost there</Eyebrow>
    <h1 className="q-title">Where should we send your result?</h1>
    <p className="q-sub">A Beehive advisor will reach out within one working day.</p>
    <TextField label="Your name" value={data.name} onChange={(v) => set({ name: v })} placeholder="First and last name" error={errors.name} autoFocus />
    <TextField label="Business name" value={data.businessName} onChange={(v) => set({ businessName: v })} placeholder="Trading or legal name" error={errors.businessName} />
    <TextField label="Work email" type="email" inputMode="email" value={data.email} onChange={(v) => set({ email: v })} placeholder="you@business.com" error={errors.email} />
    <PhoneField label="Mobile number" codeValue={data.phoneCode} codeOptions={PHONE_CODES} numberValue={data.phone}
      onCodeChange={(v) => set({ phoneCode: v })} onNumberChange={(v) => set({ phone: v })} error={errors.phone}
      maxDigits={PHONE_MAX_DIGITS[data.phoneCode] || 9} />
    <label className={`tc-row ${errors.terms ? 'has-err' : ''}`}>
      <input type="checkbox" checked={!!data.terms} onChange={(e) => set({ terms: e.target.checked })} />
      <span className="tc-text">
        I agree to Beehive's <a href="https://www.beehive.ae/terms-and-conditions" target="_blank" rel="noopener">Terms of Service</a> and <a href="https://www.beehive.ae/privacy-policy" target="_blank" rel="noopener">Privacy Policy</a>, and consent to being contacted about my application.
      </span>
    </label>
    {errors.terms && <div className="tc-err">{errors.terms}</div>}
    <label className="tc-row">
      <input type="checkbox" checked={!!data.marketingOptIn} onChange={(e) => set({ marketingOptIn: e.target.checked })} />
      <span className="tc-text">
        Yes, I'd like to receive Beehive's newsletter, funding insights and exclusive offers by email, WhatsApp and SMS. I can unsubscribe at any time.
      </span>
    </label>
  </>
);

// ============================================================================
// HubSpot
// ============================================================================
const HUBSPOT_PORTAL_ID = '2060720';
const HUBSPOT_FORM_GUID = '2e671895-4121-4572-9445-f45e0290230d';
// Was document.title inside the iframe; hard-coded so the inline embed sends the same value.
const HUBSPOT_PAGE_NAME = 'Beehive — Business Eligibility Check';
const AGE_LABELS = { '<6': 'Under 6 Months', '6-12': '6 - 12 Months', '1-2': '1 - 2 Years', '2+': '2+ Years' };
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];

const qualifyLead = (data) => {
  // We don't fund Tobacco / sheesha businesses
  if (data.industry === 'TOBACCO') return { qualified: false, reason: 'industry' };
  // We don't lend to businesses under 2 years old
  if (['<6', '6-12', '1-2'].includes(data.businessAge)) return { qualified: false, reason: 'age' };
  // Annual revenue must be at least 2M AED
  if (data.revenue < 2_000_000) return { qualified: false, reason: 'revenue' };
  return { qualified: true };
};

const validateContact = (data) => {
  const e = {};
  if (!data.name || data.name.trim().length < 2) e.name = 'Please enter your name';
  if (!data.businessName || data.businessName.trim().length < 2) e.businessName = 'Please enter your business name';
  if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) e.email = 'Enter a valid email';
  if (!data.phone || data.phone.replace(/\s/g, '').length < 6) e.phone = 'Enter a valid mobile number';
  if (!data.terms) e.terms = 'Please accept the Terms and Privacy Policy to continue';
  return e;
};

const submitToHubSpot = async (data, result) => {
  const [firstname, ...rest] = (data.name || '').trim().split(/\s+/);
  const contact = [
    ['firstname', firstname || ''],
    ['lastname', rest.join(' ') || ''],
    ['email', data.email],
    ['phone', `${data.phoneCode}${data.phone.replace(/\s/g, '')}`],
    ['company', data.businessName],
    ['age_of_business_range', AGE_LABELS[data.businessAge] || ''],
    ['product_market_sector', labelForSector(data.sector)],
    ['industry', data.industry],
    ['monthly_revenue_aed', String(data.revenue)],
    ['form_funding_amount', String(data.loanAmount)],
    ['eligibility_status', result.qualified ? 'Eligible' : 'Not eligible'],
    ['lead_source', 'Marketing Inbound'],
    ['marketing_origin', 'Online Eligibility Calculator'],
    ['marketing_email_opt_in', data.marketingOptIn ? 'true' : 'false'],
  ];
  const fields = contact.map(([name, value]) => ({ objectTypeId: '0-1', name, value }));
  // Company object — the form has a required "Company name" field (0-2/name)
  fields.push({ objectTypeId: '0-2', name: 'name', value: data.businessName });
  // Attach any UTMs relayed from the host page, if HubSpot has matching fields.
  const utms = window.beehiveUtms || {};
  UTM_KEYS.forEach((key) => {
    if (utms[key]) fields.push({ objectTypeId: '0-1', name: key, value: utms[key] });
  });
  const pageUri = window.beehiveParentUri || window.location.href;
  const res = await fetch(`https://api.hsforms.com/submissions/v3/integration/submit/${HUBSPOT_PORTAL_ID}/${HUBSPOT_FORM_GUID}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields, context: { pageUri: pageUri, pageName: HUBSPOT_PAGE_NAME } }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error('[Beehive] HubSpot rejected the submission:', res.status, detail);
  } else {
    console.info('[Beehive] HubSpot submission accepted.');
  }
  return { ok: res.ok };
};

// ============================================================================
// Tracking (GA4 / Google Ads via GTM)
//  - iframe build: push to the iframe's own dataLayer AND postMessage to the
//    parent, whose relay forwards into the site's GTM dataLayer (unchanged).
//  - embed build: we ARE on the site page, so push straight into GTM's
//    dataLayer with the same payload the relay produced. No postMessage, so
//    a leftover relay can't double-count.
// ============================================================================
const FORM_NAME = 'beehive_uae_eligibility';
window.dataLayer = window.dataLayer || [];
const trackEvent = (event, params = {}) => {
  window.dataLayer.push({ event, form_name: FORM_NAME, ...params });
  if (!EMBED) window.parent.postMessage({ source: 'beehive-eligibility-form', event, params: { form_name: FORM_NAME, ...params } }, '*');
};

let formStarted = false;
const trackFormStart = () => {
  if (formStarted) return;
  formStarted = true;
  trackEvent('form_start');
};

const STEP_LABELS = {
  age: 'business_age',
  sector: 'sector_industry',
  revenue: 'annual_revenue',
  loan: 'funding_amount',
  contact: 'contact_details',
};

// Dwell time — fires once each at 30s / 60s / 120s after load.
[30000, 60000, 120000].forEach((ms) => {
  setTimeout(() => trackEvent('dwell_time', { dwell_seconds: ms / 1000, page_path: window.location.pathname }), ms);
});

// UTMs: the host page relays them via postMessage ({ type: 'beehive_utms' }).
// Inline there is no iframe to post into, so also read them off the URL.
if (EMBED && !window.beehiveUtms) {
  const q = new URLSearchParams(window.location.search);
  window.beehiveUtms = {};
  UTM_KEYS.forEach((k) => { if (q.get(k)) window.beehiveUtms[k] = q.get(k); });
}
window.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'beehive_utms') window.beehiveUtms = e.data.utms || {};
});

// ============================================================================
// Persistence (cache answers across reload + restart)
// ============================================================================
const STORAGE_KEY = 'beehive_eligibility_v2';
const loadCache = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { return null; }
};
const saveCache = (data) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
};

const DEFAULT_DATA = {
  businessAge: '', sector: '', industry: '',
  revenue: 3_000_000, loanAmount: 500_000, revenueTouched: false, loanTouched: false,
  name: '', businessName: '', email: '', phoneCode: '+971', phone: '', terms: false, marketingOptIn: false,
};

// ============================================================================
// App
// ============================================================================
const App = () => {
  const [data, setData] = useState(() => ({ ...DEFAULT_DATA, ...(loadCache() || {}), terms: false, marketingOptIn: false }));
  const set = (patch) => setData((d) => {
    const next = { ...d, ...patch };
    saveCache(next);
    return next;
  });

  const [stepIdx, setStepIdx] = useState(0);
  const [started, setStarted] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);

  // Track first interaction with the form
  useEffect(() => {
    if (!started) return;
    const root = document.getElementById('beehive-form');
    const onFirstInput = () => trackFormStart();
    root.addEventListener('input', onFirstInput, { once: true });
    root.addEventListener('click', onFirstInput, { once: true });
    return () => {
      root.removeEventListener('input', onFirstInput);
      root.removeEventListener('click', onFirstInput);
    };
  }, [started]);

  const steps = useMemo(() => ([
    { id: 'age', component: StepAge, isValid: () => !!data.businessAge },
    { id: 'sector', component: StepSectorIndustry, isValid: () => !!data.sector && !!data.industry },
    { id: 'revenue', component: StepRevenue, isValid: () => !!data.revenueTouched },
    { id: 'loan', component: StepLoan, isValid: () => !!data.loanTouched },
    { id: 'contact', component: StepContact, isValid: () => Object.keys(validateContact(data)).length === 0 },
  ]), [data]);

  const total = steps.length;
  const current = steps[stepIdx];
  const StepComp = current.component;

  const next = useCallback(() => {
    if (stepIdx < total - 1) { setStepIdx(stepIdx + 1); setErrors({}); }
  }, [stepIdx, total]);

  const back = () => {
    if (stepIdx > 0) { setStepIdx(stepIdx - 1); setErrors({}); }
  };

  const handleSubmit = async () => {
    const v = validateContact(data);
    if (Object.keys(v).length) { setErrors(v); return; }
    setSubmitting(true);
    const result = qualifyLead(data);
    try {
      const res = await submitToHubSpot(data, result);
      trackEvent('form_submit', { qualified: !!result.qualified });
      // GA4 recommended lead-gen event — marked as a Key Event in GA4.
      if (res && res.ok) trackEvent('generate_lead', { qualified: !!result.qualified });
      setDone(result);
    } catch (err) {
      console.error('[Beehive] submit failed', err);
      trackEvent('form_submit', { qualified: !!result.qualified, error: true });
      setDone(result);
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = () => {
    trackFormStart();
    if (current.id === 'contact') {
      trackEvent('form_step_complete', { step: 'contact', step_label: STEP_LABELS.contact });
      return handleSubmit();
    }
    if (!current.isValid()) return;
    const stepParams = { step: current.id, step_label: STEP_LABELS[current.id] };
    if (current.id === 'revenue') stepParams.annual_revenue_aed = Math.round(data.revenue);
    trackEvent('form_step_complete', stepParams);
    next();
  };

  const restart = () => {
    // Cache stays. Just rewind to step 0.
    setDone(null);
    setStepIdx(0);
    setErrors({});
  };

  const startFresh = () => {
    localStorage.removeItem(STORAGE_KEY);
    setData({ ...DEFAULT_DATA });
    restart();
  };

  // Keyboard: Enter advances
  useEffect(() => {
    const onKey = (e) => {
      if (done) return;
      if (e.key === 'Enter' && current.isValid()) {
        e.preventDefault();
        handleNext();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stepIdx, data, done]);

  // Completed steps / total. Reaches 100% only on submit.
  const progress = (stepIdx / total) * 100;
  const hasCachedData = data.businessAge || data.sector || data.industry;

  return (
    <div className={`stage ${done ? 'is-done' : ''}`}>
      {!done && !started && (
        <div className="intro">
          <div className="intro-inner">
            <h1 className="intro-title">Your funding journey starts here</h1>
            <p className="intro-text">Take a 2-minute check to see what funding could look like for your business.</p>
            <button className="btn btn-primary intro-cta" onClick={() => setStarted(true)}>Begin<Ico.arrowRight /></button>
          </div>
        </div>
      )}

      {!done && started && stepIdx > 0 && hasCachedData && (
        <div className="restart-row">
          <button className="restart-btn" onClick={restart} title="Go back to the first step, keeping your answers">
            <svg {...svgProps} strokeWidth="1.6" strokeLinejoin="round" width="14" height="14"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>
            Go back and check
          </button>
        </div>
      )}

      {!done && started && (
        <div className="progress-wrap">
          <div className="progress-meta">
            <span><strong>Step {stepIdx + 1}</strong> of {total}</span>
            <span>Onward</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      <main className="main">
        {!done && started && (
          <div key={current.id} className="step">
            <StepComp data={data} set={set} next={next} errors={errors} />
          </div>
        )}
        {done && <ResultScreen data={data} result={done} onStartFresh={startFresh} />}
      </main>

      {!done && started && (
        <div className="footer-nav">
          <div className="footer-inner-col">
            <div className="footer-inner">
              <button className="btn btn-back" onClick={() => stepIdx === 0 ? setStarted(false) : back()}>Back</button>
              <button className="btn btn-primary" onClick={handleNext} disabled={!current.isValid() || submitting}>
                {submitting ? <><span className="spinner" /> Sending...</> : (current.id === 'contact' ? 'Get My Eligibility' : 'Continue')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const NEXT_STEPS = [
  ['Confirmation call', 'A Beehive representative reaches out as soon as possible.'],
  ['Share documents', 'Trade licence and bank statements, all uploaded in your portal.'],
  ['Get funded', 'Most decisions in 48 hours. Funds in your account fast.'],
];

const ResultScreen = ({ data, result, onStartFresh }) => {
  const { qualified, reason } = result;
  const firstName = (data.name || '').split(' ')[0];
  const headline = qualified ? `Great news, ${firstName}.` : `Thanks, ${firstName}.`;
  const message = qualified
    ? `Based on what you've shared, your business looks like a strong fit for Beehive funding. A representative will be in touch as soon as possible to walk you through the next steps.`
    : reason === 'industry'
      ? `Unfortunately, Beehive is unable to fund businesses in this industry at this time.`
      : reason === 'age'
        ? `Unfortunately, Beehive currently funds businesses that have been trading for over 2 years. Once you cross that mark, we'd love to hear from you again.`
        : `Unfortunately, your annual revenue is below our current funding threshold of AED 2,000,000. Let's stay in touch as your business grows.`;

  return (
    <div className="result">
      <div className="result-hero">
        <h1 className="result-title">{headline}</h1>
        <p className="result-lead">{message}</p>
      </div>
      {qualified && (
        <ol className="next-steps">
          {NEXT_STEPS.map(([title, text], i) => (
            <li key={i}>
              <span className="next-num">{i + 1}</span>
              <div className="next-text"><strong>{title}</strong><span>{text}</span></div>
            </li>
          ))}
        </ol>
      )}
      <div className="result-actions">
        <button className="btn btn-text" onClick={onStartFresh}>Start fresh</button>
      </div>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('beehive-form').firstElementChild).render(<App />);

// ── Auto-resize (iframe build only): tell the parent how tall the form is ────
if (!EMBED) {
  let last = 0;
  const send = () => {
    const h = Math.ceil(document.getElementById('beehive-form').getBoundingClientRect().height);
    if (h > 0 && Math.abs(h - last) > 1) {
      last = h;
      window.parent.postMessage({ beehiveFormHeight: h }, '*');
    }
  };
  window.addEventListener('load', send);
  if (window.ResizeObserver) new ResizeObserver(send).observe(document.getElementById('beehive-form'));
  new MutationObserver(send).observe(document.body, { childList: true, subtree: true, attributes: true });
  window.addEventListener('resize', send);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(send);
  [0, 100, 300, 600, 1000, 2000, 3500].forEach((t) => setTimeout(send, t));
}
