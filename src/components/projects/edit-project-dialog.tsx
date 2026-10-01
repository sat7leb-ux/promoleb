'use client';

import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ProjectFormDialog } from './project-form';
import type { Profile, Program, Project } from '@/types/database';

interface Props {
  project: Project;
  /** Every active profile, so the manager picker is complete. */
  profiles: Profile[];
  /** Every active program, so the link grid is complete. */
  programs: Program[];
  /** Current team members, pre-selected in the form. */
  memberIds: string[];
  /** Currently linked programs, pre-checked in the form. */
  programIds: string[];
}

/**
 * Edit trigger for the project detail page.
 *
 * The list page already holds all reference data in memory; here the detail
 * page loads it alongside the project, so both routes offer the same choices
 * and an edit never silently drops a member or a program link.
 */
export function EditProjectDialog({
  project,
  profiles,
  programs,
  memberIds,
  programIds,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="size-4" />
          Edit
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit {project.name}</DialogTitle>
          <DialogDescription>
            Update the details, team and linked programs for this project.
          </DialogDescription>
        </DialogHeader>

        <ProjectFormDialog
          key={project.id}
          project={project}
          profiles={profiles}
          programs={programs}
          memberIds={memberIds}
          programIds={programIds}
          onOpenChange={setOpen}
        />
      </DialogContent>
    </Dialog>
  );
}