import { BookOpen, CheckCircle2, Library, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { packs, templates } from '@reconforge/templates';
import { Card, PageHeader, Pill, Priority } from '../components/ui.js';

export function TemplatesPage() {
  const [needle, setNeedle] = useState('');
  const [safety, setSafety] = useState('all');
  const filtered = useMemo(
    () =>
      templates.filter((template) => {
        const text =
          `${template.name} ${template.description} ${template.category} ${template.tags.join(' ')}`.toLowerCase();
        return (
          text.includes(needle.toLowerCase()) &&
          (safety === 'all' || template.safetyLevel === safety)
        );
      }),
    [needle, safety],
  );
  return (
    <div className="page">
      <PageHeader
        eyebrow="Versioned catalog"
        title="Query templates are data, not scattered strings."
        description="Stable IDs, explicit scope compatibility, provider support, safety levels, variables, and analyst explanations make the catalog reviewable and extensible."
      />
      <div className="catalog-stats">
        <Card>
          <Library />
          <div>
            <b>{packs.length}</b>
            <span>Reconnaissance packs</span>
          </div>
        </Card>
        <Card>
          <BookOpen />
          <div>
            <b>{templates.length}</b>
            <span>Typed templates</span>
          </div>
        </Card>
        <Card>
          <CheckCircle2 />
          <div>
            <b>100%</b>
            <span>Explained & classified</span>
          </div>
        </Card>
      </div>
      <Card className="filter-bar catalog-filter">
        <label className="search-field">
          <Search size={17} />
          <input
            aria-label="Search templates"
            placeholder="Search templates, categories, or tags"
            value={needle}
            onChange={(event) => setNeedle(event.target.value)}
          />
        </label>
        <label>
          <span className="sr-only">Safety</span>
          <select value={safety} onChange={(event) => setSafety(event.target.value)}>
            <option value="all">All safety levels</option>
            <option value="low">Low</option>
            <option value="guarded">Guarded</option>
            <option value="sensitive">Sensitive</option>
          </select>
        </label>
        <span>{filtered.length} templates</span>
      </Card>
      <div className="template-grid">
        {filtered.map((template) => (
          <Card key={template.id} className="template-card">
            <div className="template-top">
              <span className="template-id">{template.id}</span>
              <Pill
                tone={
                  template.safetyLevel === 'sensitive'
                    ? 'red'
                    : template.safetyLevel === 'guarded'
                      ? 'amber'
                      : 'green'
                }
              >
                {template.safetyLevel}
              </Pill>
            </div>
            <h2>{template.name}</h2>
            <p>{template.description}</p>
            <code>
              {template.safetyLevel === 'sensitive'
                ? '[Sensitive preview redacted until an exact authorized scope is confirmed]'
                : template.template}
            </code>
            <div className="template-meta">
              <div>
                <span>Scope types</span>
                <b>{template.supportedScopeTypes.join(' · ')}</b>
              </div>
              <div>
                <span>Review priority</span>
                <Priority value={template.reviewPriority} />
              </div>
              <div>
                <span>Authorization</span>
                <b>
                  {template.requiresExplicitAuthorization
                    ? 'Explicit confirmation'
                    : 'Standard scope statement'}
                </b>
              </div>
            </div>
            <p className="template-explanation">{template.explanation}</p>
            <div className="tag-row">
              {template.tags.map((tag) => (
                <Pill key={tag}>{tag}</Pill>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
