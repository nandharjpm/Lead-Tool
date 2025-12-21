import React from 'react';
import '../components/Pricing.css';

export default function Pricing() {
  return (
    <section className="pricing-section">
      <h2 className="pricing-title">Pricing for Every Stage</h2>
      <p className="pricing-subtitle">
        Find verified emails. Scale your outreach.
      </p>

      <div className="pricing-grid">
        {/* Starter */}
        <div className="pricing-card">
          <h3>Starter</h3>
          <p className="price">$19<span>/mo</span></p>
          <ul>
            <li>2,000 email credits</li>
            <li>Auto-verification</li>
            <li>Lead enrichment</li>
            <li>Verified business emails</li>
            <li>CSV export</li>
            <li>Email support</li>
          </ul>
          <button className="pricing-btn">Start Free Trial</button>
        </div>

        {/* Pro */}
        <div className="pricing-card featured">
          <h3>Pro</h3>
          <p className="price">$49<span>/mo</span></p>
          <ul>
            <li>5,000 email credits</li>
            <li>Auto-verification</li>
            <li>Lead enrichment</li>
            <li>Bulk email finder</li>
            <li>Company & domain search</li>
            <li>Priority support</li>
          </ul>
          <button className="pricing-btn">Get Started</button>
        </div>

        {/* Enterprise */}
        <div className="pricing-card">
          <h3>Enterprise</h3>
          <p className="price">$99<span>/mo</span></p>
          <ul>
            <li>20,000+ email credits</li>
            <li>Auto-verification</li>
            <li>Lead enrichment</li>
            <li>Team access</li>
            <li>API access</li>
            <li>Dedicated support</li>
          </ul>
          <button className="pricing-btn">Contact Sales</button>
        </div>
      </div>
    </section>
  );
}
