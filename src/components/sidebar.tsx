"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Activity,
  Bell,
  LayoutDashboard,
  MapPin,
  Users,
  FlaskConical,
  Kanban,
  PhoneCall,
  Route,
  Sprout,
  CalendarDays,
  FileBarChart,
  FileText,
  Menu,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth-provider";
import { NudgeBell } from "@/components/nudges/nudge-bell";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

const navLinks: NavLink[] = [
  { href: "/dashboard",   label: "Dashboard",   icon: LayoutDashboard },
  { href: "/calls",       label: "Calls",       icon: PhoneCall },
  { href: "/nudges",      label: "Nudges",      icon: Bell },
  { href: "/digest",      label: "Digest",      icon: FileText },
  { href: "/field-intel", label: "Field Intel",  icon: Activity, adminOnly: true },
  { href: "/courses",     label: "Courses",     icon: MapPin },
  { href: "/contacts",    label: "Contacts",    icon: Users },
  { href: "/visits",      label: "Visits",      icon: Route },
  { href: "/pipeline",    label: "Deals",       icon: Kanban },
  { href: "/products",    label: "Products",    icon: FlaskConical },
  { href: "/calendar",    label: "Calendar",    icon: CalendarDays },
  { href: "/reports",     label: "Reports",     icon: FileBarChart },
];

function NavContent({ onLinkClick }: { onLinkClick?: () => void }) {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();
  const isAdmin = profile?.role === "admin";

  const visibleLinks = navLinks.filter((link) => !link.adminOnly || isAdmin);

  return (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
          <Sprout className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-base font-semibold tracking-tight">
            Allturf <span className="text-primary">LTD</span>
          </h1>
          <p className="text-[11px] text-muted-foreground leading-none">
            Turf Products &amp; Consultation
          </p>
        </div>
      </div>

      {/* Nav links */}
      <ScrollArea className="flex-1 px-3">
        <nav className="flex flex-col gap-0.5 py-2">
          {visibleLinks.map((link) => {
            const isActive =
              pathname === link.href ||
              (link.href !== "/dashboard" && pathname.startsWith(link.href + "/"));
            const Icon = link.icon;

            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={onLinkClick}
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150",
                  isActive
                    ? "bg-primary/10 text-primary dark:bg-primary/15"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <Icon
                  className={cn(
                    "h-[18px] w-[18px] shrink-0 transition-colors",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground group-hover:text-foreground"
                  )}
                />
                {link.label}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      {/* Bottom section — scenic image with user overlay */}
      <div className="mt-auto">
        <div className="relative h-[220px] overflow-hidden rounded-t-xl">
          {/* Gradient overlay — blends photo into sidebar background */}
          <div className="absolute inset-0 z-10 bg-gradient-to-b from-card via-card/60 to-transparent dark:from-card dark:via-card/70 dark:to-transparent" />
          <Image
            src="/golf-sunset.jpg"
            alt=""
            aria-hidden="true"
            fill
            className="object-cover object-center"
            sizes="240px"
          />

          {/* User name + sign out overlaying bottom of image */}
          {profile && (
            <div className="absolute bottom-0 inset-x-0 z-20 flex items-center gap-2 bg-gradient-to-t from-black/70 to-transparent px-4 pb-3 pt-8">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/20 text-xs font-semibold text-white backdrop-blur-sm">
                {profile.full_name
                  ? profile.full_name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()
                  : profile.email[0].toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium leading-tight text-white">
                  {profile.full_name || profile.email}
                </p>
                {profile.territory && (
                  <p className="truncate text-[11px] leading-tight text-white/70">
                    {profile.territory}
                  </p>
                )}
              </div>
              <button
                onClick={signOut}
                className="shrink-0 rounded-md p-1 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                title="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 border-r border-border bg-card lg:block">
      <div className="sticky top-0 h-screen">
        <NavContent />
      </div>
    </aside>
  );
}

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-card/95 px-4 backdrop-blur lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="shrink-0">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle navigation</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-60 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <NavContent onLinkClick={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex flex-1 items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
          <Sprout className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="text-sm font-semibold">
          Allturf <span className="text-primary">LTD</span>
        </span>
      </div>

      <NudgeBell />
    </div>
  );
}
