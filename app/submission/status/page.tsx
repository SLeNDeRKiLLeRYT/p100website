"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import supabase from "@/lib/supabase-client";
import BackgroundWrapper from "@/components/BackgroundWrapper";

type SubmissionStatus = "pending" | "approved" | "rejected";

interface Submission {
  id: string;
  status: SubmissionStatus;
  username: string;
  created_at: string;
  killer_id?: string;
  survivor_id?: string;
  rejection_reason?: string;
}

interface Suggestion {
  username: string;
}

export default function SubmissionStatusPage() {
  const [username, setUsername] = useState("");
  const [committedUsername, setCommittedUsername] = useState(""); // last searched username
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const selectionMade = useRef(false);
  const [killerNames, setKillerNames] = useState<Record<string, string>>({});
  const [survivorNames, setSurvivorNames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (selectionMade.current) {
      selectionMade.current = false;
      return;
    }
    const term = username.trim();
    if (term.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        let suggestionError: any = null;
        let data: any[] | null = null;
        // Primary: correct table name used elsewhere (p100_submissions)
        const primary = await supabase
          .from('p100_submissions')
          .select('username')
          .ilike('username', `%${term}%`);
        if (primary.error) {
          suggestionError = primary.error;
        } else {
          data = primary.data;
        }

        // Fallback: legacy/simple name if primary 404s / misconfigured
        if ((!data || data.length === 0) && suggestionError) {
          const fallback = await supabase
            .from('submissions')
            .select('username')
            .ilike('username', `%${term}%`);
          if (!fallback.error) {
            data = fallback.data;
          }
        }
        const error = suggestionError;
        if (error && !data) {
          console.warn("Suggestion query failed:", error.message || error);
          throw new Error("Failed to fetch suggestions.");
        }
        
        if (data) {
          const uniqueUsernames = [...new Set(data.map(item => item.username).filter(Boolean))];
          setSuggestions(uniqueUsernames.sort().slice(0, 10).map(uname => ({ username: uname })));
          setShowSuggestions(uniqueUsernames.length > 0);
        } else {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      } catch (error) {
        console.error(error);
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [username]);

  const handleSuggestionClick = (selectedUsername: string) => {
    setUsername(selectedUsername);
    setShowSuggestions(false);
    selectionMade.current = true;
  };

  const checkStatus = async () => {
    const uname = username.trim();
    if (!uname) {
      setError("Please enter a username.");
      return;
    }

    setCommittedUsername(uname); // show only the last searched username
    setLoading(true);
    setError(null);
    setSubmissions([]);
    setKillerNames({});
    setSurvivorNames({});

    try {
      let fetchError: any = null;
      let data: any[] | null = null;

      // Do NOT select 'comment'
      const primary = await supabase
        .from("p100_submissions")
        .select("id, status, username, created_at, killer_id, survivor_id, rejection_reason")
        .eq("username", uname)
        .order("created_at", { ascending: false });
      if (primary.error) {
        fetchError = primary.error;
      } else {
        data = primary.data;
      }

      if ((!data || data.length === 0) && fetchError) {
        const fallback = await supabase
          .from("submissions")
          .select("id, status, username, created_at, killer_id, survivor_id, rejection_reason")
          .eq("username", uname)
          .order("created_at", { ascending: false });
        if (!fallback.error) {
          data = fallback.data;
        }
      }

      if (fetchError && !data) {
        console.warn("Primary submissions fetch failed:", fetchError.message || fetchError);
        throw new Error("Could not fetch submissions or an error occurred.");
      }

      if (data && data.length > 0) {
        // Resolve IDs to names
        const killerIds = Array.from(new Set(data.map(d => d.killer_id).filter(Boolean)));
        const survivorIds = Array.from(new Set(data.map(d => d.survivor_id).filter(Boolean)));

        const [killersRes, survivorsRes] = await Promise.all([
          killerIds.length
            ? supabase.from("killers").select("id, name").in("id", killerIds)
            : Promise.resolve({ data: [], error: null }),
          survivorIds.length
            ? supabase.from("survivors").select("id, name").in("id", survivorIds)
            : Promise.resolve({ data: [], error: null }),
        ]);

        if (killersRes.data) {
          setKillerNames(Object.fromEntries(killersRes.data.map((k: any) => [k.id, k.name])));
        }
        if (survivorsRes.data) {
          setSurvivorNames(Object.fromEntries(survivorsRes.data.map((s: any) => [s.id, s.name])));
        }

        setSubmissions(data as Submission[]);
      } else {
        setError("No submissions found for this username.");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getCharacterName = (submission: Submission) => {
    if (submission.killer_id) return `${killerNames[submission.killer_id] || submission.killer_id}`;
    if (submission.survivor_id) return `${survivorNames[submission.survivor_id] || submission.survivor_id}`;
    return "Unknown Character";
  };

  return (
    <BackgroundWrapper backgroundUrl="/status.png">
      <div className="container mx-auto p-4 flex justify-center items-center min-h-screen">
        <Card className="max-w-2xl w-full mx-auto bg-black/80 border border-red-600/50 text-white">
          <CardHeader>
            <CardTitle className="text-center text-3xl font-bold tracking-wider uppercase">Check Your Submission Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col space-y-4">
              <p className="text-center text-gray-300">Enter the username you used to submit to see its current status.</p>
              <div className="relative">
                <div className="flex space-x-2">
                  <Input
                    type="text"
                    placeholder="Enter your username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="bg-black border-red-600 focus:border-red-400 text-white"
                  />
                  <Button onClick={checkStatus} disabled={loading} className="bg-red-700 hover:bg-red-600">
                    {loading ? "Checking..." : "Check Status"}
                  </Button>
                </div>
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-black border border-red-600 rounded-lg shadow-lg">
                    {suggestions.map((s, index) => (
                      <button
                        key={index}
                        onClick={() => handleSuggestionClick(s.username)}
                        className="w-full p-3 text-left text-white hover:bg-red-900 transition-colors"
                      >
                        {s.username}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {error && <p className="text-red-500 text-center">{error}</p>}
              {submissions.length > 0 && (
                <div className="pt-4 space-y-4">
                  <h3 className="font-bold text-xl text-center">
                    Submissions for '{committedUsername}':
                  </h3>
                  {submissions.map((submission) => (
                    <div key={submission.id} className="p-4 border border-gray-700 rounded-lg bg-gray-900/50">
                      <p><strong>Submitted P100:</strong> {getCharacterName(submission)}</p>
                      <p><strong>Submitted At:</strong> {new Date(submission.created_at).toLocaleString()}</p>
                      <p>
                        <strong>Status:</strong>{" "}
                        <span
                          className={`font-bold ${
                            submission.status === "approved"
                              ? "text-green-500"
                              : submission.status === "rejected"
                              ? "text-red-500"
                              : "text-yellow-500"
                          }`}
                        >
                          {submission.status}
                        </span>
                      </p>
                      {submission.status === "rejected" && submission.rejection_reason && (
                        <p className="text-red-400">
                          <strong>Reason:</strong> {submission.rejection_reason}
                        </p>
                      )}
                      {/* Intentionally not rendering user-submitted comments */}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </BackgroundWrapper>
  );
}
