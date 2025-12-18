import React from "react";
import "../components/Features.css";

export default function Features() {
  return (
    <section className="features-section">
      <h2 className="features-title">Built for Modern Cold Outreach</h2>
      <p className="features-subtitle">
        Find verified emails, send smarter outreach, and learn what actually works.
      </p>

      <div className="features-grid">
        <div className="feature-card">
          <h3>Email Finder</h3>
          <p>
            Instantly find verified business emails using name and domain-based
            searches with high accuracy.
          </p>
        </div>

        <div className="feature-card">
          <h3>Bulk Search</h3>
          <p>
            Upload lists and find emails in bulk. Perfect for sales teams and
            large outreach campaigns.
          </p>
        </div>

        <div className="feature-card">
          <h3>Email Verification</h3>
          <p>
            Reduce bounce rates with built-in verification before sending any
            outreach emails.
          </p>
        </div>

        <div className="feature-card">
          <h3>Cold Outreach Playbooks</h3>
          <p>
            Learn proven cold email frameworks, subject lines, and follow-up
            strategies from our blog.
          </p>
        </div>

        <div className="feature-card">
          <h3>Educational Blog</h3>
          <p>
            Step-by-step guides on cold outreach, deliverability, personalization,
            and scaling safely.
          </p>
        </div>

        <div className="feature-card">
          <h3>Compliance & Best Practices</h3>
          <p>
            Stay compliant with GDPR & CAN-SPAM through our educational content
            and responsible outreach guidelines.
          </p>
        </div>
      </div>
    </section>
  );
}
