"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Plus, Trash2, ArrowRight, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { COURSE_COLORS, COURSE_ICONS } from "@/lib/constants";

interface OnboardingCourse {
  name: string;
  code: string;
  professor: string;
  color: string;
  icon: string;
  schedule: Array<{ day: number; startTime: string; endTime: string; location: string }>;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function OnboardingScreen() {
  const router = useRouter();
  const { update: updateSession } = useSession();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [institution, setInstitution] = useState("");
  const [semesterName, setSemesterName] = useState("Fall Semester");
  const [semesterStart, setSemesterStart] = useState("");
  const [semesterEnd, setSemesterEnd] = useState("");
  const [courses, setCourses] = useState<OnboardingCourse[]>([
    { name: "", code: "", professor: "", color: COURSE_COLORS[0], icon: "BookOpen", schedule: [] },
  ]);
  const [goals, setGoals] = useState<
    Array<{ title: string; target: number; unit: string; type: string }>
  >([
    { title: "Study 15 hours this week", target: 15, unit: "hours", type: "STUDY_HOURS" },
  ]);
  const [habits, setHabits] = useState<Array<{ name: string; color: string; targetPerWeek: number }>>(
    [{ name: "Daily reading", color: "#10b981", targetPerWeek: 7 }]
  );
  const [loading, setLoading] = useState(false);
  const [skipAll, setSkipAll] = useState(false);

  function addCourse() {
    setCourses((prev) => [
      ...prev,
      {
        name: "",
        code: "",
        professor: "",
        color: COURSE_COLORS[prev.length % COURSE_COLORS.length],
        icon: COURSE_ICONS[prev.length % COURSE_ICONS.length],
        schedule: [],
      },
    ]);
  }

  function updateCourse(idx: number, patch: Partial<OnboardingCourse>) {
    setCourses((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  }

  function removeCourse(idx: number) {
    setCourses((prev) => prev.filter((_, i) => i !== idx));
  }

  function addSchedule(courseIdx: number) {
    setCourses((prev) =>
      prev.map((c, i) =>
        i === courseIdx
          ? { ...c, schedule: [...c.schedule, { day: 1, startTime: "09:00", endTime: "10:00", location: "" }] }
          : c
      )
    );
  }

  function updateSchedule(courseIdx: number, scheduleIdx: number, patch: Partial<{ day: number; startTime: string; endTime: string; location: string }>) {
    setCourses((prev) =>
      prev.map((c, i) =>
        i === courseIdx
          ? {
              ...c,
              schedule: c.schedule.map((s, j) => (j === scheduleIdx ? { ...s, ...patch } : s)),
            }
          : c
      )
    );
  }

  function removeSchedule(courseIdx: number, scheduleIdx: number) {
    setCourses((prev) =>
      prev.map((c, i) =>
        i === courseIdx ? { ...c, schedule: c.schedule.filter((_, j) => j !== scheduleIdx) } : c
      )
    );
  }

  async function finish() {
    setLoading(true);
    try {
      const payload = {
        name: name || undefined,
        institution: institution || null,
        semesterName: semesterName || null,
        semesterStart: semesterStart || null,
        semesterEnd: semesterEnd || null,
        courses: skipAll ? [] : courses.filter((c) => c.name.trim()).map((c) => ({
          name: c.name,
          code: c.code,
          professor: c.professor || null,
          color: c.color,
          icon: c.icon,
          schedule: c.schedule,
        })),
        goals: skipAll ? [] : goals.filter((g) => g.title.trim()),
        habits: skipAll ? [] : habits.filter((h) => h.name.trim()),
      };
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "Could not save your information. Please try again.");
        setLoading(false);
        return;
      }
      toast.success("Welcome to Dyne!");
      // Force-update the JWT (this triggers the `jwt` callback with trigger="update"
      // which re-fetches the latest onboarded flag from the DB).
      await updateSession();
      // Poll the session endpoint until onboarded is reflected (max 3s).
      for (let i = 0; i < 15; i++) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        try {
          const sessRes = await fetch("/api/auth/session", { cache: "no-store" });
          const sess = await sessRes.json();
          if (sess?.user?.onboarded === true) break;
        } catch {
          /* ignore */
        }
      }
      // Hard navigate to root with fresh session
      window.location.href = "/";
    } catch {
      toast.error("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  const totalSteps = 3;

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-3xl">
        <div className="flex items-center gap-2 mb-6">
          <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
            D
          </div>
          <span className="text-xl font-semibold tracking-tight">Dyne</span>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-sm text-muted-foreground hidden sm:inline">
              Step {step + 1} of {totalSteps}
            </span>
            <Button variant="ghost" size="sm" onClick={() => setSkipAll(true)}>
              Skip all
            </Button>
          </div>
        </div>

        <Card className="dyne-card-shadow">
          <CardHeader>
            <CardTitle className="text-2xl">
              {step === 0 && "Tell us about yourself"}
              {step === 1 && "Set up your courses"}
              {step === 2 && "Goals & habits (optional)"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {step === 0 && (
              <>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Your name</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Alex Johnson"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="institution">Institution</Label>
                    <Input
                      id="institution"
                      value={institution}
                      onChange={(e) => setInstitution(e.target.value)}
                      placeholder="University of Somewhere"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sem">Semester name</Label>
                  <Input
                    id="sem"
                    value={semesterName}
                    onChange={(e) => setSemesterName(e.target.value)}
                    placeholder="Fall 2025"
                  />
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="semStart">Semester start</Label>
                    <Input
                      id="semStart"
                      type="date"
                      value={semesterStart}
                      onChange={(e) => setSemesterStart(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="semEnd">Semester end</Label>
                    <Input
                      id="semEnd"
                      type="date"
                      value={semesterEnd}
                      onChange={(e) => setSemesterEnd(e.target.value)}
                    />
                  </div>
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <div className="space-y-4">
                  {courses.map((c, idx) => (
                    <div key={idx} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-6 w-6 rounded-md"
                            style={{ backgroundColor: c.color }}
                          />
                          <span className="font-medium">
                            {c.name || `Course ${idx + 1}`}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeCourse(idx)}
                          disabled={courses.length === 1}
                          aria-label="Remove course"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid sm:grid-cols-3 gap-3">
                        <Input
                          placeholder="Course name"
                          value={c.name}
                          onChange={(e) => updateCourse(idx, { name: e.target.value })}
                        />
                        <Input
                          placeholder="Code (e.g. CS 101)"
                          value={c.code}
                          onChange={(e) => updateCourse(idx, { code: e.target.value })}
                        />
                        <Input
                          placeholder="Professor"
                          value={c.professor}
                          onChange={(e) => updateCourse(idx, { professor: e.target.value })}
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <Label className="text-xs text-muted-foreground">Color</Label>
                        <Select
                          value={c.color}
                          onValueChange={(v) => updateCourse(idx, { color: v })}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {COURSE_COLORS.map((col) => (
                              <SelectItem key={col} value={col}>
                                <div className="flex items-center gap-2">
                                  <div className="h-4 w-4 rounded" style={{ backgroundColor: col }} />
                                  <span>{col}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Label className="text-xs text-muted-foreground ml-2">Icon</Label>
                        <Select
                          value={c.icon}
                          onValueChange={(v) => updateCourse(idx, { icon: v })}
                        >
                          <SelectTrigger className="w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {COURSE_ICONS.map((ic) => (
                              <SelectItem key={ic} value={ic}>
                                {ic}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm">Weekly schedule</Label>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => addSchedule(idx)}
                          >
                            <Plus className="h-4 w-4 mr-1" /> Add session
                          </Button>
                        </div>
                        {c.schedule.length === 0 && (
                          <p className="text-xs text-muted-foreground">
                            No sessions yet — add when your class meets.
                          </p>
                        )}
                        <div className="space-y-2">
                          {c.schedule.map((s, sIdx) => (
                            <div
                              key={sIdx}
                              className="grid grid-cols-1 sm:grid-cols-[100px_1fr_1fr_1fr_auto] gap-2 items-center"
                            >
                              <Select
                                value={String(s.day)}
                                onValueChange={(v) =>
                                  updateSchedule(idx, sIdx, { day: parseInt(v, 10) })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {DAY_LABELS.map((d, i) => (
                                    <SelectItem key={i} value={String(i)}>
                                      {d}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Input
                                type="time"
                                value={s.startTime}
                                onChange={(e) =>
                                  updateSchedule(idx, sIdx, { startTime: e.target.value })
                                }
                              />
                              <Input
                                type="time"
                                value={s.endTime}
                                onChange={(e) =>
                                  updateSchedule(idx, sIdx, { endTime: e.target.value })
                                }
                              />
                              <Input
                                placeholder="Location"
                                value={s.location}
                                onChange={(e) =>
                                  updateSchedule(idx, sIdx, { location: e.target.value })
                                }
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeSchedule(idx, sIdx)}
                                aria-label="Remove session"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <Button variant="outline" onClick={addCourse}>
                  <Plus className="h-4 w-4 mr-1" /> Add course
                </Button>
              </>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Goals</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setGoals((g) => [
                          ...g,
                          { title: "", target: 10, unit: "", type: "CUSTOM" },
                        ])
                      }
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add goal
                    </Button>
                  </div>
                  {goals.map((g, idx) => (
                    <div key={idx} className="grid grid-cols-1 sm:grid-cols-[1fr_120px_120px_auto] gap-2 items-center">
                      <Input
                        placeholder="Goal title"
                        value={g.title}
                        onChange={(e) =>
                          setGoals((prev) =>
                            prev.map((x, i) => (i === idx ? { ...x, title: e.target.value } : x))
                          )
                        }
                      />
                      <Input
                        type="number"
                        placeholder="Target"
                        value={g.target}
                        onChange={(e) =>
                          setGoals((prev) =>
                            prev.map((x, i) =>
                              i === idx ? { ...x, target: Number(e.target.value) } : x
                            )
                          )
                        }
                      />
                      <Input
                        placeholder="Unit (e.g. hours)"
                        value={g.unit}
                        onChange={(e) =>
                          setGoals((prev) =>
                            prev.map((x, i) => (i === idx ? { ...x, unit: e.target.value } : x))
                          )
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setGoals((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {goals.length === 0 && (
                    <p className="text-sm text-muted-foreground">No goals added.</p>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Habits</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setHabits((h) => [
                          ...h,
                          { name: "", color: "#0ea5e9", targetPerWeek: 7 },
                        ])
                      }
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add habit
                    </Button>
                  </div>
                  {habits.map((h, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-1 sm:grid-cols-[1fr_120px_120px_auto] gap-2 items-center"
                    >
                      <Input
                        placeholder="Habit name"
                        value={h.name}
                        onChange={(e) =>
                          setHabits((prev) =>
                            prev.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x))
                          )
                        }
                      />
                      <Select
                        value={h.color}
                        onValueChange={(v) =>
                          setHabits((prev) =>
                            prev.map((x, i) => (i === idx ? { ...x, color: v } : x))
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {COURSE_COLORS.map((col) => (
                            <SelectItem key={col} value={col}>
                              <div className="flex items-center gap-2">
                                <div className="h-4 w-4 rounded" style={{ backgroundColor: col }} />
                                <span>{col}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        min={1}
                        max={7}
                        placeholder="Per week"
                        value={h.targetPerWeek}
                        onChange={(e) =>
                          setHabits((prev) =>
                            prev.map((x, i) =>
                              i === idx ? { ...x, targetPerWeek: Number(e.target.value) } : x
                            )
                          )
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setHabits((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {habits.length === 0 && (
                    <p className="text-sm text-muted-foreground">No habits added.</p>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t">
              <Button
                variant="ghost"
                onClick={() => (step === 0 ? finish() : setStep(step - 1))}
                disabled={loading}
              >
                {step === 0 ? "Skip" : "Back"}
              </Button>
              <div className="flex items-center gap-2">
                {step < totalSteps - 1 ? (
                  <Button onClick={() => setStep(step + 1)} disabled={loading}>
                    Continue
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                ) : (
                  <Button onClick={finish} disabled={loading}>
                    {loading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                    <Sparkles className="h-4 w-4 mr-1" />
                    Take me to Dyne
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        <p className="text-center text-xs text-muted-foreground mt-4">
          You can change everything later in Settings.
        </p>
      </div>
    </div>
  );
}
