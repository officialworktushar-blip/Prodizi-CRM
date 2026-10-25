"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  CalendarCheck,
  IndianRupee,
  Search,
  UserRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useDeferredValue, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Skeleton } from "@/components/ui/skeleton";
import { useRole } from "@/hooks/use-role";
import { LEAD_STATUS_LABELS, type LeadStatus } from "@/lib/constants";
import { isAdminRole } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/client";

export function GlobalSearch() {
  const router = useRouter();
  const { role } = useRole();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const deferredTerm = useDeferredValue(term);
  const searchTerm = deferredTerm.trim();
  const pattern = `%${searchTerm}%`;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const searchQuery = useQuery({
    queryKey: ["global-search", role, searchTerm],
    enabled: open && Boolean(role),
    staleTime: 30_000,
    queryFn: async () => {
      const supabase = createClient();
      const leadsQuery = supabase
        .from("leads")
        .select("id, client_name, company, status")
        .order("updated_at", { ascending: false })
        .limit(8);
      const tasksQuery = supabase
        .from("tasks")
        .select("id, title, status")
        .order("updated_at", { ascending: false })
        .limit(8);
      const salesQuery = supabase
        .from("sales")
        .select("id, client_name, total_amount")
        .order("created_at", { ascending: false })
        .limit(8);

      const [leads, tasks, sales] = await Promise.all([
        searchTerm ? leadsQuery.ilike("client_name", pattern) : leadsQuery,
        searchTerm ? tasksQuery.ilike("title", pattern) : tasksQuery,
        searchTerm ? salesQuery.ilike("client_name", pattern) : salesQuery,
      ]);

      const memberQuery = supabase
        .from("profiles")
        .select("id, full_name, role, email")
        .eq("is_active", true);
      const members = isAdminRole(role)
        ? ((
            await (searchTerm
              ? memberQuery.ilike("full_name", pattern)
              : memberQuery
            )
              .order("full_name")
              .limit(8)
          ).data ?? [])
        : [];

      return {
        leads: leads.data ?? [],
        tasks: tasks.data ?? [],
        members,
        sales: sales.data ?? [],
      };
    },
  });

  const select = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <>
      <Button
        variant="outline"
        className="ml-1 hidden h-9 w-full max-w-sm justify-start gap-2 px-3 font-normal text-muted-foreground md:flex"
        onClick={() => setOpen(true)}
      >
        <Search className="size-4" />
        <span>Search leads, tasks, team...</span>
        <kbd className="ml-auto rounded border bg-muted px-1.5 py-0.5 text-[0.65rem] font-medium">
          Ctrl K
        </kbd>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        aria-label="Search"
        onClick={() => setOpen(true)}
      >
        <Search className="size-4" />
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={(value) => {
          setOpen(value);
          if (!value) setTerm("");
        }}
        title="Search"
        description="Search leads, tasks, team members and sales."
        className="sm:max-w-xl"
      >
        <CommandInput
          placeholder="Search leads, tasks, team members..."
          value={term}
          onValueChange={setTerm}
        />
        <CommandList className="max-h-96">
          {searchQuery.isLoading ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-8 w-full" />
              ))}
            </div>
          ) : (
            <>
              <CommandEmpty>No results found.</CommandEmpty>

              {searchQuery.data?.leads.length ? (
                <>
                  <CommandGroup heading="Leads">
                    {searchQuery.data.leads.map((lead) => (
                      <CommandItem
                        key={lead.id}
                        value={`${lead.client_name} ${lead.company ?? ""}`}
                        onSelect={() => select(`/leads/${lead.id}`)}
                      >
                        <Building2 className="size-4 text-muted-foreground" />
                        <span className="truncate">{lead.client_name}</span>
                        <span className="ml-auto truncate text-xs text-muted-foreground">
                          {lead.company ||
                            LEAD_STATUS_LABELS[lead.status as LeadStatus]}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  <CommandSeparator />
                </>
              ) : null}

              {searchQuery.data?.tasks.length ? (
                <>
                  <CommandGroup heading="Tasks">
                    {searchQuery.data.tasks.map((task) => (
                      <CommandItem
                        key={task.id}
                        value={task.title}
                        onSelect={() => select("/tasks")}
                      >
                        <CalendarCheck className="size-4 text-muted-foreground" />
                        <span className="truncate">{task.title}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  <CommandSeparator />
                </>
              ) : null}

              {searchQuery.data?.members.length ? (
                <>
                  <CommandGroup heading="Team">
                    {searchQuery.data.members.map((member) => (
                      <CommandItem
                        key={member.id}
                        value={`${member.full_name} ${member.email ?? ""}`}
                        onSelect={() => select(`/team/${member.id}`)}
                      >
                        <UserRound className="size-4 text-muted-foreground" />
                        <span className="truncate">{member.full_name}</span>
                        <span className="ml-auto truncate text-xs text-muted-foreground">
                          {member.email}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  <CommandSeparator />
                </>
              ) : null}

              {searchQuery.data?.sales.length ? (
                <CommandGroup heading="Sales">
                  {searchQuery.data.sales.map((sale) => (
                    <CommandItem
                      key={sale.id}
                      value={sale.client_name}
                      onSelect={() => select(`/sales/${sale.id}`)}
                    >
                      <IndianRupee className="size-4 text-muted-foreground" />
                      <span className="truncate">{sale.client_name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}

