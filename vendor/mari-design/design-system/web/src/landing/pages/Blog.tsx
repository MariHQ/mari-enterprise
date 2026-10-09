import { Link } from "react-router-dom";
import { Calendar, Clock } from "lucide-react";
import { SiteHeader } from "@landing/components/SiteHeader";
import { posts } from "@landing/generated/blog";

const authorImages: Record<string, string> = {
  "Daniel Henneberger": "/images/henneberger.jpeg",
  "Eric Disque": "/images/disque.jpg",
};

const TAG_PALETTE: Record<string, string> = {
  agents: "bg-primary/10 text-primary-glow border-primary/30",
  automation: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  platform: "bg-purple-500/10 text-purple-700 border-purple-500/30",
  comparison: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  skills: "bg-cyan-500/10 text-cyan-700 border-cyan-500/30",
  docs: "bg-lime-500/10 text-lime-700 border-lime-500/30",
};
const tagClass = (tag: string) =>
  TAG_PALETTE[tag] ?? "bg-surface-2 text-muted-foreground border-border";

const Blog = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      <section className="relative pt-16 pb-10">
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute left-1/2 -translate-x-1/2 top-[-8%] h-[420px] w-[900px] rounded-full blur-3xl opacity-40"
               style={{ background: "radial-gradient(closest-side, hsl(var(--primary)/0.4), transparent 70%)" }} />
          <div className="absolute inset-0 bg-grid opacity-[0.12]" />
        </div>

        <div className="mx-auto max-w-6xl px-6">
          <div className="text-xs font-mono text-primary-glow uppercase tracking-widest mb-3">/ Field notes</div>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight max-w-3xl">
            Notes from the <span className="text-gradient">documentation tide.</span>
          </h1>
          <p className="mt-4 text-muted-foreground text-lg max-w-2xl">
            Hand-written essays on agents, platform engineering, and the unfashionable parts of writing things down.
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-6 pb-24">
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {posts.map((post) => (
            <li key={post.slug} className="flex">
              <Link
                to={`/blog/${post.slug}`}
                className="group flex flex-col w-full bg-surface border border-border/80 rounded-2xl overflow-hidden hover:border-foreground/40 hover:-translate-y-0.5 transition-all"
              >
                <div className="aspect-square w-full bg-surface-2 overflow-hidden border-b border-border/60">
                  {post.cover ? (
                    <img
                      src={post.cover}
                      alt=""
                      className="h-full w-full object-cover group-hover:scale-[1.02] transition-transform duration-700"
                      loading="lazy"
                    />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-primary/20 to-purple-500/20" />
                  )}
                </div>

                <div className="p-5 flex flex-col flex-1">
                  {post.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {post.tags.slice(0, 2).map((t) => (
                        <span key={t} className={`text-[10px] font-mono uppercase tracking-widest border rounded-full px-2 py-0.5 ${tagClass(t)}`}>
                          {t}
                        </span>
                      ))}
                    </div>
                  )}

                  <h3 className="text-lg font-semibold tracking-tight leading-snug group-hover:text-primary-glow transition-colors">
                    {post.title}
                  </h3>
                  {post.description && (
                    <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{post.description}</p>
                  )}

                  <div className="mt-auto pt-4 border-t border-border/60 flex items-center gap-3">
                    <img
                      src={authorImages[post.author] ?? "/images/henneberger.jpeg"}
                      alt={post.author}
                      className="h-7 w-7 rounded-full object-cover ring-1 ring-border"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{post.author}</div>
                      <div className="text-[11px] font-mono text-muted-foreground flex items-center gap-2">
                        <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{post.date}</span>
                        <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{post.readingMinutes}m</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-20 glass border border-border/80 rounded-2xl p-8 text-center">
          <h3 className="text-2xl font-semibold tracking-tight">Want this in your inbox?</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Drop into the community — we cross-post every essay there first.
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <a href="https://discord.gg/RdZyvwevp" target="_blank" rel="noopener noreferrer"
               className="inline-flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary-glow font-medium text-sm px-4 py-2.5 rounded-xl transition-colors">
              Join Discord
            </a>
            <a href="https://join.slack.com/t/mari-v9h7907/shared_invite/zt-3xjdp77m9-Oh2~ZJO1toLUzHFgLeQgEA" target="_blank" rel="noopener noreferrer"
               className="inline-flex items-center gap-2 bg-surface-2 border border-border hover:border-muted-foreground/50 text-sm font-medium px-4 py-2.5 rounded-xl transition-colors">
              Join Slack
            </a>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Blog;
