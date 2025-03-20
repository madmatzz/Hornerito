import React from 'react';
import Head from 'next/head';
import Link from 'next/link';

export default function Home() {
  return (
    <div>
      <Head>
        <title>Hornerito Bot Dashboard</title>
        <meta name="description" content="Expense tracking dashboard for Hornerito Bot" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main>
        <h1>Welcome to Hornerito Bot Dashboard</h1>
        <p>Your expense tracking companion</p>
        <div className="features">
          <h2>Features</h2>
          <ul>
            <li>Track expenses via Telegram</li>
            <li>View expense statistics</li>
            <li>Export your data</li>
            <li>Multi-currency support</li>
          </ul>
        </div>
        <div className="cta">
          <p>Start tracking your expenses with Hornerito Bot!</p>
          <Link href="https://t.me/your_bot_username">
            <a className="button">Open in Telegram</a>
          </Link>
        </div>
      </main>

      <style jsx>{`
        main {
          padding: 2rem;
          text-align: center;
          max-width: 800px;
          margin: 0 auto;
        }
        h1 {
          color: #333;
          margin-bottom: 1rem;
        }
        .features {
          margin: 2rem 0;
          text-align: left;
        }
        .features ul {
          list-style: none;
          padding: 0;
        }
        .features li {
          margin: 0.5rem 0;
          padding-left: 1.5rem;
          position: relative;
        }
        .features li:before {
          content: "✓";
          position: absolute;
          left: 0;
          color: #4CAF50;
        }
        .cta {
          margin-top: 2rem;
        }
        .button {
          display: inline-block;
          padding: 0.8rem 1.5rem;
          background-color: #0088cc;
          color: white;
          text-decoration: none;
          border-radius: 5px;
          margin-top: 1rem;
          transition: background-color 0.3s;
        }
        .button:hover {
          background-color: #006699;
        }
      `}</style>
    </div>
  );
} 