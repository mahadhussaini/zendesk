import React, { useEffect, useMemo, useState } from 'react';

function trimText(text, max = 120) {
  if (!text) return '';
  const clean = String(text).trim();
  return clean.length > max ? clean.slice(0, max - 1) + '…' : clean;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function formatClockTime(date) {
  try {
    const d = date instanceof Date ? date : new Date(date);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  } catch {
    return '';
  }
}

function buildReplyDraft({
  customerName,
  companyName,
  city,
  subject,
  description,
  tone,
}) {
  const politeOpeners = [
    'thanks for reaching out',
    'thank you for contacting us',
    'appreciate you getting in touch',
  ];
  const reviewPhrases = [
    "I've reviewed your message",
    "I've looked over your request",
    'I have reviewed the details you shared',
  ];
  const nextSteps = [
    "Here's what I can do next:",
    'Next steps from my side:',
    'To move forward, I can:',
  ];

  const friendlyBody = (
    `Hi ${customerName}, ${pick(politeOpeners)} about “${subject}”. ` +
    `${pick(reviewPhrases)} and your account with ${companyName} in ${city}. ` +
    `${pick(nextSteps)}\n\n` +
    '- Review your account settings and recent activity\n' +
    '- Suggest the best path to resolve this\n' +
    '- Follow up with any additional info needed\n\n' +
    'Please confirm any extra details so I can proceed.\n\n' +
    'Best regards,\nSupport'
  );

  const conciseBody = (
    `Hi ${customerName}, thanks for contacting us about “${subject}”. ` +
    `I reviewed your ${companyName} account (location: ${city}). ` +
    'Next steps:\n' +
    '- Verify account setup\n' +
    '- Provide resolution options\n' +
    '- Confirm details to proceed\n\n' +
    'Reply with any extra details.\n\n' +
    'Thanks,\nSupport'
  );

  const body = tone === 'concise' ? conciseBody : friendlyBody;

  // Optionally weave in a tiny summary of the description if available
  const desc = description ? `\n\nContext noted: “${trimText(description, 140)}”` : '';
  return body + desc;
}

async function getTicketDataViaZAF() {
  if (!window.ZAFClient) return null;
  const client = window.ZAFClient.init();
  try {
    const data = await client.get([
      'ticket.requester.email',
      'ticket.subject',
      'ticket.description',
    ]);
    return {
      email: data['ticket.requester.email'],
      subject: data['ticket.subject'],
      description: data['ticket.description'],
      client,
    };
  } catch (err) {
    return { error: 'Failed to read ticket data' };
  }
}

function getTicketDataFromQuery() {
  const url = new URL(window.location.href);
  const email = url.searchParams.get('email') || 'Sincere@april.biz';
  const subject = url.searchParams.get('subject') || 'Sample subject about billing';
  const description = url.searchParams.get('description') || 'Customer reports an issue with their billing cycle and needs assistance.';
  return { email, subject, description };
}

export default function App() {
  const [ticket, setTicket] = useState({ email: '', subject: '', description: '' });
  const [customer, setCustomer] = useState(null); // { id, name, company, address.city, website }
  const [posts, setPosts] = useState([]); // last 3 titles
  const [tone, setTone] = useState('friendly'); // 'friendly' | 'concise'
  const [draft, setDraft] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [client, setClient] = useState(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

  const hasData = useMemo(() => !!ticket.email, [ticket.email]);

  useEffect(() => {
    initialize();
  }, []);

  useEffect(() => {
    if (!ticket.email) return;
    generateDraft();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket, customer, tone]);

  async function initialize() {
    setIsLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const zafData = await getTicketDataViaZAF();
      let nextTicket = { email: '', subject: '', description: '' };
      if (zafData && !zafData.error) {
        setClient(zafData.client);
        nextTicket = {
          email: zafData.email || '',
          subject: zafData.subject || '',
          description: zafData.description || '',
        };
      } else {
        nextTicket = getTicketDataFromQuery();
      }
      setTicket(nextTicket);
      await fetchCustomerAndPosts(nextTicket.email);
    } catch (err) {
      setError('Initialization failed');
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchCustomerAndPosts(emailOverride) {
    const emailToUse = (emailOverride ?? ticket.email) || '';
    if (!emailToUse) return;
    setError(null);
    setNotFound(false);
    try {
      const usersResp = await fetch(`https://jsonplaceholder.typicode.com/users?email=${encodeURIComponent(emailToUse)}`);
      if (!usersResp.ok) throw new Error('Failed to fetch user');
      const users = await usersResp.json();
      if (!users || users.length === 0) {
        setCustomer(null);
        setPosts([]);
        setNotFound(true);
        setLastUpdatedAt(new Date());
        return;
      }
      const u = users[0];
      setCustomer(u);

      const postsResp = await fetch(`https://jsonplaceholder.typicode.com/posts?userId=${u.id}`);
      if (!postsResp.ok) throw new Error('Failed to fetch posts');
      const allPosts = await postsResp.json();
      const last3 = (allPosts || []).slice(-3).reverse().map(p => p.title);
      setPosts(last3);
      setLastUpdatedAt(new Date());
    } catch (err) {
      setError('Network error while fetching data');
      setPosts([]);
    }
  }

  function generateDraft() {
    if (!ticket.email) return;
    const name = customer?.name || 'there';
    const company = customer?.company?.name || 'your company';
    const city = customer?.address?.city || 'your city';
    const subject = ticket.subject || 'your request';
    const description = ticket.description || '';
    const text = buildReplyDraft({
      customerName: name,
      companyName: company,
      city,
      subject,
      description,
      tone,
    });
    setDraft(text);
  }

  async function handleRefresh() {
    setIsRefreshing(true);
    await initialize();
    setIsRefreshing(false);
  }

  function handleRegenerate() {
    generateDraft();
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(draft);
      toast('Copied to clipboard');
    } catch (err) {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = draft;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      toast('Copied to clipboard');
    }
  }

  function toast(message) {
    // Minimal inline toast
    const el = document.createElement('div');
    el.textContent = message;
    el.className = 'toast';
    document.body.appendChild(el);
    setTimeout(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 200);
    }, 1600);
  }

  const TicketCard = () => (
    <div className="card">
      <div className="card-title">Ticket</div>
      <div className="kv"><span>Email</span><span title={ticket.email}>{trimText(ticket.email, 40)}</span></div>
      <div className="kv"><span>Subject</span><span title={ticket.subject}>{trimText(ticket.subject, 60)}</span></div>
      <div className="kv" style={{ alignItems: 'start' }}>
        <span>Description</span>
        <details>
          <summary className="summary">{trimText(ticket.description, 120)}</summary>
          <div className="desc-full">{ticket.description}</div>
        </details>
      </div>
    </div>
  );

  const CustomerCard = () => {
    if (!customer && notFound) {
      return (
        <div className="card">
          <div className="card-title">Customer</div>
          <div className="empty">
            <span className="badge badge-warn">Not found</span>
            <div className="muted">No customer matched the requester email.</div>
          </div>
        </div>
      );
    }
    if (!customer) {
      return (
        <div className="card">
          <div className="card-title">Customer</div>
          <div className="muted">Looking up customer…</div>
        </div>
      );
    }
    const initials = (customer.name || '?').trim().slice(0, 1).toUpperCase();
    const websiteUrl = customer.website ? (customer.website.startsWith('http') ? customer.website : `https://${customer.website}`) : null;
    return (
      <div className="card">
        <div className="card-title">Customer</div>
        <div className="profile">
          <div className="avatar" aria-hidden>{initials}</div>
          <div className="profile-meta">
            <div className="profile-name">{customer.name}</div>
            <div className="muted small">ID #{customer.id}</div>
          </div>
        </div>
        <div className="kv"><span>Company</span><span title={customer.company?.name}>{trimText(customer.company?.name, 40)}</span></div>
        <div className="kv"><span>City</span><span title={customer.address?.city}>{trimText(customer.address?.city, 40)}</span></div>
        <div className="kv"><span>Website</span><span>{websiteUrl ? <a className="link" href={websiteUrl} target="_blank" rel="noreferrer">{trimText(customer.website, 40)}</a> : '-'}</span></div>
      </div>
    );
  };

  const PostsCard = () => (
    <div className="card">
      <div className="card-title">Last 3 Posts</div>
      {posts.length === 0 && !notFound && <div className="muted">No posts</div>}
      {posts.length > 0 && (
        <ol className="posts numbered">
          {posts.map((t, idx) => (
            <li key={idx} title={t}>{trimText(t, 90)}</li>
          ))}
        </ol>
      )}
    </div>
  );

  const DraftCard = () => (
    <div className="card">
      <div className="card-title row">
        <span>Reply Draft</span>
        <div className="segmented" role="tablist" aria-label="Tone selector">
          <button
            className={`seg-option ${tone === 'friendly' ? 'active' : ''}`}
            onClick={() => setTone('friendly')}
            role="tab"
            aria-selected={tone === 'friendly'}
          >Friendly</button>
          <button
            className={`seg-option ${tone === 'concise' ? 'active' : ''}`}
            onClick={() => setTone('concise')}
            role="tab"
            aria-selected={tone === 'concise'}
          >Concise</button>
        </div>
      </div>
      <textarea className="draft" value={draft} onChange={(e) => setDraft(e.target.value)} />
      <div className="row buttons">
        <button className="btn" onClick={handleRegenerate} title="Generate again">Regenerate</button>
        <button className="btn btn-primary" onClick={handleCopy} title="Copy reply">Copy to Clipboard</button>
        <button className="btn btn-ghost" onClick={handleRefresh} disabled={isRefreshing}>{isRefreshing ? 'Refreshing…' : 'Refresh Data'}</button>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="container">
        <div className="header">
          <div className="title skeleton-block" style={{ width: 180, height: 20 }} />
          <div className="subtitle skeleton-block" style={{ width: 120, height: 14 }} />
        </div>
        <div className="skeleton card" style={{ height: 126 }} />
        <div className="skeleton card" style={{ height: 154 }} />
        <div className="skeleton card" style={{ height: 160 }} />
        <div className="skeleton card" style={{ height: 240 }} />
      </div>
    );
  }

  return (
    <div className="container">
      <div className="header">
        <div className="title">ZenYC Public API Mini</div>
        <div className="subtitle">
          {ticket.email ? (
            <span className="badge">{trimText(ticket.email, 32)}</span>
          ) : (
            <span className="badge muted">No requester</span>
          )}
          {lastUpdatedAt && <span className="muted"> • Updated {formatClockTime(lastUpdatedAt)}</span>}
        </div>
      </div>
      {error && (
        <div className="error">
          <div>{error}</div>
          <button className="btn" onClick={() => { setError(null); fetchCustomerAndPosts(); }}>Retry</button>
        </div>
      )}
      {hasData && <TicketCard />}
      <CustomerCard />
      <PostsCard />
      <DraftCard />
    </div>
  );
}

