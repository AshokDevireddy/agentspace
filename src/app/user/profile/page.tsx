"use client"

import React, { useState, useEffect } from "react";
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
  is_admin: boolean;
  position_id: string | null;
  position: {
    id: string;
    name: string;
    level: number;
  } | null;
}

interface Position {
  position_id: string;
  name: string;
  level: number;
  description: string | null;
  is_active: boolean;
}

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [positions, setPositions] = useState<Position[]>([]);
  const [selectedPositionId, setSelectedPositionId] = useState<string>("");
  const [updatingPosition, setUpdatingPosition] = useState(false);


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
          setSelectedPositionId(result.data.position_id || "");
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

  // Fetch positions if admin
  useEffect(() => {
    const fetchPositions = async () => {
      if (!profileData?.is_admin) return;

      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        const accessToken = session?.access_token;

        if (!accessToken) {
          console.error('No access token available');
          return;
        }

        const response = await fetch('/api/positions', {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          setPositions(data || []);
        } else {
          console.error('Failed to fetch positions:', response.status, await response.text());
        }
      } catch (error) {
        console.error('Error fetching positions:', error);
      }
    };

    fetchPositions();
  }, [profileData?.is_admin]);

  // Handle position update
  const handlePositionUpdate = async () => {
    if (!selectedPositionId) return;

    setUpdatingPosition(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      if (!accessToken) {
        alert('Not authenticated');
        return;
      }

      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ position_id: selectedPositionId }),
      });

      const result = await response.json();

      if (result.success) {
        // Refresh profile data
        const profileResponse = await fetch(`/api/user/profile?user_id=${user?.id}`);
        const profileResult = await profileResponse.json();
        if (profileResult.success) {
          setProfileData(profileResult.data);
        }
        alert('Position updated successfully!');
      } else {
        console.error('Failed to update position:', result.error);
        alert('Failed to update position: ' + result.error);
      }
    } catch (error) {
      console.error('Error updating position:', error);
      alert('Error updating position');
    } finally {
      setUpdatingPosition(false);
    }
  };


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
          </div>
        </div>
      </div>

      {/* Position Selection (Admin Only) */}
      {profileData.is_admin && (
        <div className="w-full max-w-3xl bg-card rounded-2xl shadow border border-border p-6 mb-8">
          <h2 className="text-xl font-bold text-foreground mb-4">Position</h2>
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Current Position: {profileData.position?.name || 'Not Set'}
              </label>
              <select
                value={selectedPositionId}
                onChange={(e) => setSelectedPositionId(e.target.value)}
                className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Select Position</option>
                {positions.map((position) => (
                  <option key={position.position_id} value={position.position_id}>
                    {position.name} (Level {position.level})
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handlePositionUpdate}
              disabled={updatingPosition || !selectedPositionId || selectedPositionId === profileData.position_id}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updatingPosition ? 'Updating...' : 'Update Position'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
