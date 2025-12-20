import React from "react";
import "../components/Features.css";

export default function Features() {
  return (
    <section className="features-section">
      {/* H1 for SEO (important) */}
    <h2 className="features-main-title">
  Smarter Email Outreach
</h2>

<p className="features-intro">
  Supercharge your prospecting with our all-in-one email solution for sales, recruiters, and marketers. 
  Locate accurate business contacts, ensure deliverability, and boost the effectiveness of your cold email campaigns.
</p>


      <div className="features-grid">
        <article className="feature-card">
          <h2>Email Finder</h2>
          <p>
            Instantly find verified business email addresses using name and domain searches. Achieve high accuracy for your B2B outreach.
          </p>
        </article>

        <article className="feature-card">
          <h2>Bulk Email Search</h2>
          <p>
            Upload large contact lists and find emails in bulk, perfect for sales teams and large-scale campaigns.
          </p>
        </article>

        <article className="feature-card">
          <h2>Email Verification</h2>
          <p>
            Reduce bounce rates and protect your sender reputation with built-in email verification before sending outreach.
          </p>
        </article>

        <article className="feature-card">
          <h2>Cold Outreach Playbooks</h2>
          <p>
            Access proven cold email frameworks, subject lines, and follow-up strategies to maximize response rates.
          </p>
        </article>

        <article className="feature-card">
          <h2>Educational Blog</h2>
          <p>
            Learn step-by-step guides on cold outreach, deliverability, personalization, and scaling safely for your campaigns.
          </p>
        </article>

        <article className="feature-card">
          <h2>Compliance & Best Practices</h2>
          <p>
            Stay compliant with GDPR & CAN-SPAM through our guidelines and responsible email outreach best practices.
          </p>
        </article>
      </div>
    </section>
  );
}
