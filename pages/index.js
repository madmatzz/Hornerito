import React from 'react';
import Head from 'next/head';

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
      </main>

      <style jsx>{`
        main {
          padding: 2rem;
          text-align: center;
        }
        h1 {
          color: #333;
          margin-bottom: 1rem;
        }
      `}</style>
    </div>
  );
} 