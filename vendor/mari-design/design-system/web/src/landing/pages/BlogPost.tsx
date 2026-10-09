import { Link, useParams, Navigate } from "react-router-dom";
import { ArrowLeft, Calendar, Clock } from "lucide-react";
import { SiteHeader } from "@landing/components/SiteHeader";
import { getPost } from "@landing/generated/blog";

const authorImages: Record<string, string> = {
  "Daniel Henneberger": "/images/henneberger.jpeg",
  "Eric Disque": "/images/disque.jpg",
};

const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();
  const post = slug ? getPost(slug) : undefined;

  if (!post) return <Navigate to="/blog" replace />;

  const authorImage = authorImages[post.author] ?? "/images/henneberger.jpeg";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      <main className="mx-auto max-w-2xl px-6 py-12">
        <Link to="/blog" className="inline-flex items-center gap-2 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors mb-8">
          <ArrowLeft className="h-3 w-3" /> All posts
        </Link>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-5">
            <img
              src={authorImage}
              alt={post.author}
              className="h-10 w-10 rounded-full object-cover ring-1 ring-border"
            />
            <div>
              <div className="text-sm font-medium leading-tight">{post.author}</div>
              <div className="text-[11px] font-mono text-muted-foreground flex items-center gap-3">
                <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" /> {post.date}</span>
                <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {post.readingMinutes} min read</span>
              </div>
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight leading-[1.1]">{post.title}</h1>
          {post.description && (
            <p className="mt-4 text-muted-foreground text-lg">{post.description}</p>
          )}
        </div>

        {post.cover && (
          <div className="mb-10 rounded-2xl overflow-hidden border border-border/60 bg-surface-2">
            <img src={post.cover} alt="" className="w-full block" />
          </div>
        )}

        <article
          className="prose-mari"
          dangerouslySetInnerHTML={{ __html: post.html }}
        />

        <div className="mt-16 pt-8 border-t border-border/60">
          <div className="flex items-center gap-4 mb-6">
            <img src={authorImage} alt="" className="h-12 w-12 rounded-full object-cover ring-1 ring-border" />
            <div>
              <div className="font-semibold">{post.author}</div>
              <div className="text-sm text-muted-foreground">Building Mari · find me on <a className="hover:text-foreground transition-colors underline underline-offset-2" href="https://discord.gg/RdZyvwevp" target="_blank" rel="noopener noreferrer">Discord</a></div>
            </div>
          </div>
          <Link to="/blog" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to all posts
          </Link>
        </div>
      </main>
    </div>
  );
};

export default BlogPost;
