import heroImg from './assets/codex-clipboard-5604074e-2d44-45b6-bf30-d001f65c3dbe.jpg'

const sales = [
  { item: 'Linen Summer Shirt', time: '10:42 AM', amount: '₹1,899' },
  { item: 'Classic Straight Jeans', time: '10:18 AM', amount: '₹2,499' },
  { item: 'Cotton Everyday Tee', time: '09:56 AM', amount: '₹899' },
]

function App() {
  return (
    <div className="min-h-screen bg-[#f5f1eb] text-[#2c241f] md:flex">
      <aside className="hidden w-64 shrink-0 flex-col bg-[#261d18] text-white md:flex">
        <div className="border-b border-white/10 px-7 py-7">
          <p className="text-xs font-semibold tracking-[0.28em] text-[#d8b991]">THREAD & CO.</p>
          <p className="mt-2 text-sm text-white/55">Store management</p>
        </div>

        <nav className="flex-1 space-y-2 px-4 py-6">
          {[
            ['▦', 'Overview'],
            ['▧', 'Products'],
            ['▤', 'Inventory'],
            ['＋', 'New sale'],
            ['▥', 'Reports'],
          ].map(([icon, label], index) => (
            <button
              key={label}
              type="button"
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm ${
                index === 0
                  ? 'bg-[#d8b991] font-semibold text-[#261d18]'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`}
            >
              <span className="w-5 text-center">{icon}</span>
              {label}
            </button>
          ))}
        </nav>

        <div className="border-t border-white/10 p-5">
          <p className="text-sm font-medium">Shivang</p>
          <p className="mt-1 text-xs text-white/50">Store manager</p>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <header className="flex items-center justify-between border-b border-[#e8e0d6] bg-white px-5 py-4 md:px-8">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#9a8068]">Clothing store</p>
            <h1 className="mt-1 text-lg font-semibold">Store overview</h1>
          </div>
          <div className="rounded-full bg-[#f3eee8] px-4 py-2 text-sm text-[#67584c]">
            Today · 15 Oct
          </div>
        </header>

        <div className="mx-auto max-w-7xl space-y-6 p-5 md:p-8">
          <section
            className="flex min-h-64 flex-col justify-center rounded-3xl bg-cover bg-center p-7 text-white md:p-10"
            style={{
              backgroundImage: `linear-gradient(90deg, rgba(35, 27, 22, 0.88), rgba(35, 27, 22, 0.18)), url(${heroImg})`,
            }}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#f0d2ad]">
              Your store, at a glance
            </p>
            <h2 className="mt-3 max-w-xl text-3xl font-semibold leading-tight md:text-4xl">
              Good morning, Shivang
            </h2>
            <p className="mt-3 max-w-lg text-sm leading-6 text-white/80">
              Keep track of today’s sales, stock, and the details that keep your store running smoothly.
            </p>
            <button
              type="button"
              className="mt-6 w-fit rounded-xl bg-[#d8b991] px-5 py-3 text-sm font-semibold text-[#261d18] hover:bg-[#e5c9a5]"
            >
              Record a sale
            </button>
          </section>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ['Sales today', '₹18,420', '+8.2% from yesterday'],
              ['Items sold', '24', 'Across 18 transactions'],
              ['Products', '186', 'Across all categories'],
              ['Low stock', '7', 'Items need attention'],
            ].map(([label, value, note]) => (
              <article key={label} className="rounded-2xl border border-[#ebe3d9] bg-white p-5 shadow-sm">
                <p className="text-sm text-[#817366]">{label}</p>
                <p className="mt-3 text-2xl font-semibold">{value}</p>
                <p className="mt-2 text-xs text-[#9a8068]">{note}</p>
              </article>
            ))}
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
            <article className="rounded-2xl border border-[#ebe3d9] bg-white p-5 shadow-sm md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">Recent sales</h3>
                  <p className="mt-1 text-sm text-[#817366]">Latest transactions from your store</p>
                </div>
                <button type="button" className="text-sm font-medium text-[#8b6747]">View all</button>
              </div>

              <div className="mt-5 divide-y divide-[#f0ebe5]">
                {sales.map((sale) => (
                  <div key={sale.item} className="flex items-center justify-between py-4">
                    <div>
                      <p className="text-sm font-medium">{sale.item}</p>
                      <p className="mt-1 text-xs text-[#928579]">{sale.time}</p>
                    </div>
                    <p className="text-sm font-semibold">{sale.amount}</p>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-2xl border border-[#ebe3d9] bg-white p-5 shadow-sm md:p-6">
              <h3 className="font-semibold">Stock to check</h3>
              <p className="mt-1 text-sm text-[#817366]">These variants are running low</p>

              <div className="mt-5 space-y-4">
                {[
                  ['Classic Denim Jacket', 'Size M · Indigo', '2 left'],
                  ['Linen Summer Shirt', 'Size L · Sand', '3 left'],
                  ['Cotton Everyday Tee', 'Size S · White', '4 left'],
                ].map(([name, variant, count]) => (
                  <div key={name} className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{name}</p>
                      <p className="mt-1 text-xs text-[#928579]">{variant}</p>
                    </div>
                    <span className="whitespace-nowrap rounded-full bg-[#f7eee2] px-3 py-1 text-xs font-medium text-[#8b6747]">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <p className="pb-3 text-center text-xs text-[#9a8e82]">
            Sample dashboard figures · Store data will be connected later
          </p>
        </div>
      </main>
    </div>
  )
}

export default App