import { Ban, Braces, Database, FileCheck2, Network, Scale, ShieldCheck } from 'lucide-react';
import { Card, PageHeader, Pill } from '../components/ui.js';

export function AboutPage() {
  return (
    <div className="page">
      <PageHeader
        eyebrow="Architecture, methodology & ethical use"
        title="A passive lead-generation tool—with deliberate limits."
        description="ReconForge Web separates planning from collection, treats provider content as untrusted data, and keeps active validation outside the product."
      />
      <section className="principle-grid">
        <Card>
          <ShieldCheck />
          <h2>Authorized scope first</h2>
          <p>
            Every project records a normalized boundary and authorization statement before queries
            are created.
          </p>
        </Card>
        <Card>
          <Network />
          <h2>Passive by design</h2>
          <p>
            Queries and official search metadata only. No port scans, brute force, credential
            testing, or target crawling.
          </p>
        </Card>
        <Card>
          <Scale />
          <h2>Priority, not verdict</h2>
          <p>
            A finding’s review priority organizes analyst attention. It never claims a weakness
            exists.
          </p>
        </Card>
      </section>
      <Card className="architecture-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Trust boundaries</span>
            <h2>Two operating modes, one typed core</h2>
          </div>
          <Pill tone="cyan">Local-first</Pill>
        </div>
        <div className="architecture-flow">
          <div>
            <span>
              <Braces />
            </span>
            <b>Browser planner</b>
            <small>React + IndexedDB</small>
          </div>
          <i>scope + template IDs</i>
          <div>
            <span>
              <ShieldCheck />
            </span>
            <b>Core engine</b>
            <small>PSL, queries, normalization, exports</small>
          </div>
          <i>authenticated request</i>
          <div>
            <span>
              <Database />
            </span>
            <b>Owner API</b>
            <small>Quotas + fixed provider adapters</small>
          </div>
        </div>
        <p>
          The static planner contains no provider keys and cannot spend the project owner’s quota.
          The optional API independently parses the scope, finds known templates by stable ID,
          applies hard limits, and then calls a fixed official endpoint. There is no arbitrary
          URL-fetch or raw-query proxy.
        </p>
      </Card>
      <div className="method-grid">
        <Card>
          <span className="eyebrow">Methodology</span>
          <h2>What ReconForge does</h2>
          <ul className="check-list">
            <li>
              <FileCheck2 />
              Classifies exact, subdomain-tree, and public-suffix scopes
            </li>
            <li>
              <FileCheck2 />
              Compiles explained, provider-aware queries
            </li>
            <li>
              <FileCheck2 />
              Canonicalizes and deduplicates public result URLs
            </li>
            <li>
              <FileCheck2 />
              Preserves provenance, timestamps, notes, tags, and status
            </li>
            <li>
              <FileCheck2 />
              Exports escaped reports with limitations
            </li>
          </ul>
        </Card>
        <Card>
          <span className="eyebrow">Hard exclusions</span>
          <h2>What it will not do</h2>
          <ul className="ban-list">
            <li>
              <Ban />
              Scrape prohibited search-result HTML or evade CAPTCHAs
            </li>
            <li>
              <Ban />
              Probe ports, exploit vulnerabilities, or test credentials
            </li>
            <li>
              <Ban />
              Rotate proxies or bypass provider limits
            </li>
            <li>
              <Ban />
              Download discovered archives, databases, or secrets
            </li>
            <li>
              <Ban />
              Perform bulk suffix-wide CT, DNS, archive, or code enumeration
            </li>
          </ul>
        </Card>
      </div>
      <Card className="limitations">
        <span className="eyebrow">Interpretation</span>
        <h2>Discovery is not validation.</h2>
        <p>
          Search indexes can be incomplete, stale, personalized, and incorrect. A title or snippet
          can describe content that has changed or never belonged to the assessed entity. Analysts
          should confirm asset ownership, intended access, freshness, and business context through
          an authorized manual process before escalation.
        </p>
      </Card>
    </div>
  );
}
