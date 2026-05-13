import { Mail, Plus, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function ContactsPage() {
  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-normal">Contacts</h1>
          <p className="text-sm text-muted-foreground">Recruiters and hiring teams.</p>
        </div>
        <Button variant="outline">
          <Plus />
          Add
        </Button>
      </div>
      <section className="grid min-h-80 place-items-center rounded-lg border bg-card">
        <div className="grid place-items-center gap-3 text-center">
          <div className="grid size-10 place-items-center rounded-md bg-secondary">
            <UserRound className="size-5 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">No contacts yet</h2>
            <p className="mt-1 flex items-center justify-center gap-1 text-sm text-muted-foreground">
              <Mail className="size-4" />
              Add contacts from application details.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
