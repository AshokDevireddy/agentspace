"use client"

import React, { useState, useEffect } from "react";
import { FaRegClock } from "react-icons/fa6";
import { useAuth } from "@/providers/AuthProvider";
import { createClient } from "@/lib/supabase/client";

interface ProfileData {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  createdAt: string;
  totalProduction: number;
  totalPoliciesSold: number;
}

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  // Calculate tenure from created_at
  const calculateTenure = (createdAt: string) => {
    if (!createdAt) return "Unknown";

    const created = new Date(createdAt);
    const now = new Date();

    let years = now.getFullYear() - created.getFullYear();
    let months = now.getMonth() - created.getMonth();

    if (months < 0) {
      years--;
      months += 12;
    }

    const parts = [];
    if (years > 0) {
      parts.push(`${years} year${years !== 1 ? 's' : ''}`);
    }
    if (months > 0) {
      parts.push(`${months} month${months !== 1 ? 's' : ''}`);
    }

    return parts.length > 0 ? parts.join(', ') : "Less than a month";
  };

  // Fetch user profile data from API
  useEffect(() => {
    const fetchProfileData = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/user/profile?user_id=${user.id}`);

        if (!response.ok) {
          throw new Error('Failed to fetch profile data');
        }

        const result = await response.json();

        if (result.success) {
          setProfileData(result.data);
        } else {
          console.error('API Error:', result.error);
        }
      } catch (error) {
        console.error('Error fetching profile data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, [user]);

  // Helper for formatting currency
  const formatCurrency = (amount: number) =>
    `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Helper for formatting large numbers
  const formatLargeNumber = (num: number) =>
    num.toLocaleString();

  // Show loading screen until data is ready
  if (authLoading || loading || !profileData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  // Prepare user object with API data
  const user_profile = {
    name: profileData.fullName,
    avatarUrl: "", // Keep as empty for now
    tenure: calculateTenure(profileData.createdAt),
    allTimeProduction: profileData.totalProduction,
    totalPoliciesSold: profileData.totalPoliciesSold,
    weeklyStats: [
      {
        label: "This Week",
        range: "May 26 - June 1, 2025", // Keep static for now
        production: 0, // Keep static for now
        policiesSold: 0, // Keep static for now
      },
    ],
  };

  return (
    <div className="flex flex-col items-center w-full min-h-screen bg-background py-8">
      {/* Profile Card */}
      <div className="w-full max-w-3xl bg-gradient-to-br from-[#f5f6ff] to-[#f5f6ff] rounded-2xl shadow-md p-8 mb-8">
        <div className="flex items-center">
          {/* Avatar */}
          <div className="w-32 h-32 bg-gray-200 rounded-lg flex items-center justify-center mr-8 shadow">
            {/* Show avatar if available, else fallback */}
            {user_profile.avatarUrl ? (
              <img src={user_profile.avatarUrl} alt="Profile" className="w-full h-full object-cover rounded-lg" />
            ) : (
              <svg className="w-20 h-20 text-muted-foreground" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="8" r="5" />
                <path d="M12 14c-5 0-8 2.5-8 5v1h16v-1c0-2.5-3-5-8-5z" />
              </svg>
            )}
          </div>
          {/* Info */}
          <div>
            <h1 className="text-4xl font-extrabold text-foreground mb-1">{user_profile.name}</h1>
            <div className="flex items-center mb-4 mt-3">
              <FaRegClock className="text-muted-foreground mr-2" />
              <span className="text-foreground text-sm">{user_profile.tenure}</span>
            </div>
            <div className="flex gap-4">
              <div className="bg-card rounded-xl px-6 py-3 shadow flex flex-col items-center border border-border">
                <span className="text-sm font-semibold text-muted-foreground">All-Time Production</span>
                <span className="text-2xl font-bold text-indigo-600 mt-1">
                  {`$${(user_profile.allTimeProduction / 1_000_000).toFixed(2)}M`}
                </span>
              </div>
              <div className="bg-card rounded-xl px-6 py-3 shadow flex flex-col items-center border border-border">
                <span className="text-sm font-semibold text-muted-foreground">Total Policies Sold</span>
                <span className="text-2xl font-bold text-indigo-600 mt-1">
                  {formatLargeNumber(user_profile.totalPoliciesSold)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Weekly Stats Tabs */}
      <div className="w-full max-w-3xl bg-card rounded-2xl shadow border border-border">
        <div className="flex border-b border-border">
          <button className="px-6 py-3 font-semibold text-primary border-b-2 border-primary bg-card rounded-tl-2xl">
            This Week
          </button>
          <button className="px-6 py-3 font-semibold text-indigo-600 hover:text-indigo-800">
            Last Week
          </button>
        </div>
        <div className="p-8">
          <div className="text-2xl font-extrabold text-foreground mb-4">
            {user_profile.weeklyStats[0].range}
          </div>
          <div className="flex gap-8">
            <div className="flex flex-col items-center bg-accent rounded-xl px-8 py-4">
              <span className="font-semibold text-foreground">Production</span>
              <span className="text-xl font-bold text-indigo-600 mt-1">
                {formatCurrency(user_profile.weeklyStats[0].production)}
              </span>
            </div>
            <div className="flex flex-col items-center bg-accent rounded-xl px-8 py-4">
              <span className="font-semibold text-foreground">Policies Sold</span>
              <span className="text-xl font-bold text-indigo-600 mt-1">
                {user_profile.weeklyStats[0].policiesSold}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
