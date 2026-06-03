"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { Search, Grid3X3, List, Filter, ArrowRight, Users, Sparkles, Bot, Flame, TrendingUp, Lock, ShieldCheck } from "lucide-react"
import { ROOMS, ROOM_CATEGORIES, ROOM_CATEGORY_LABELS, type Room, BLOCKED_TOPICS, isTopicBlocked } from "@/lib/rooms"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { RoomModelInfo, AdultRoomWarning, UnrestrictedRoomBadge, PremiumModelBadge } from "@/components/model-selector"

// Room Browser Component
// Updated to reflect KLOOM's room-based philosophy:
// - Rooms are TOPICS, not people
// - No one-person rooms
// - Models are FIXED per room
// - Only 3 blocked topics: army, killing, fraud
export function RoomBrowser({
  onRoomSelect,
}: {
  onRoomSelect?: (room: Room) => void
}) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")

  // Filter rooms based on search and category
  const filteredRooms = useMemo(() => {
    let result = [...ROOMS]

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(
        (room) =>
          room.name.toLowerCase().includes(query) ||
          room.tagline.toLowerCase().includes(query) ||
          room.description.toLowerCase().includes(query) ||
          room.topic.toLowerCase().includes(query) ||
          room.tags?.some((kw) => kw.toLowerCase().includes(query)) ||
          room.personas.some(p => p.name.toLowerCase().includes(query))
      )
    }

    // Filter by category
    if (selectedCategory) {
      result = result.filter((room) => room.category === selectedCategory)
    }

    return result
  }, [searchQuery, selectedCategory])

  // Group rooms by category
  const roomsByCategory = useMemo(() => {
    const grouped: Record<string, Room[]> = {}
    filteredRooms.forEach((room) => {
      const category = room.category || "other"
      if (!grouped[category]) grouped[category] = []
      grouped[category].push(room)
    })
    return grouped
  }, [filteredRooms])

  // Get featured rooms
  const featuredRooms = useMemo(() => {
    return filteredRooms.filter((room) => room.featured).slice(0, 6)
  }, [filteredRooms])

  // Get popular rooms
  const popularRooms = useMemo(() => {
    return filteredRooms.filter((room) => room.popular).slice(0, 6)
  }, [filteredRooms])

  // Get unrestricted rooms
  const unrestrictedRooms = useMemo(() => {
    return filteredRooms.filter((room) => room.restrictions?.unrestricted).slice(0, 4)
  }, [filteredRooms])

  // Get adult rooms
  const adultRooms = useMemo(() => {
    return filteredRooms.filter((room) => room.adult)
  }, [filteredRooms])

  return (
    <div className="flex flex-col h-full bg-stone-950">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-stone-800">
        <div>
          <h1 className="text-2xl font-black text-white">Rooms</h1>
          <p className="text-white/60 mt-1">
            <span className="text-white">Rooms are TOPICS, not people</span> - Multi-AI conference voice chat
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}>
            {viewMode === "grid" ? <Grid3X3 size={16} /> : <List size={16} />}
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="p-6">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <Input
            type="text"
            placeholder="Search rooms by topic, name, or persona..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-stone-900 border-stone-800 text-white"
          />
        </div>
        
        {/* Blocked topics notice */}
        <div className="mt-3 flex items-center gap-2 text-xs text-white/40">
          <ShieldCheck size={12} className="text-cyan-400" />
          <span>Only 3 topics blocked: <span className="text-white/60">army, killing, fraud</span> - Everything else is open</span>
        </div>
      </div>

      {/* Category Chips */}
      <div className="px-6 pb-4">
        <div className="flex gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
              selectedCategory === null
                ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                : "bg-stone-900 text-white/60 border border-stone-800 hover:bg-stone-800/50"
            }`}
          >
            All Rooms
          </button>
          {ROOM_CATEGORIES.map((category) => {
            const label = ROOM_CATEGORY_LABELS[category]
            const count = roomsByCategory[category]?.length || 0
            return (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1 ${
                  selectedCategory === category
                    ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                    : "bg-stone-900 text-white/60 border border-stone-800 hover:bg-stone-800/50"
                }`}
              >
                <span>{label.icon}</span> {label.label}
                <span className="text-white/40">({count})</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Featured Rooms */}
      {featuredRooms.length > 0 && (
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">Featured Rooms</h2>
            <div className="flex items-center gap-2">
              <UnrestrictedRoomBadge />
              <span className="text-xs text-white/40">Teaching first, implementation second</span>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {featuredRooms.map((room) => (
              <RoomCard key={room.id} room={room} viewMode={viewMode} />
            ))}
          </div>
        </div>
      )}

      {/* Unrestricted Rooms */}
      {unrestrictedRooms.length > 0 && (
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">Unrestricted Rooms</h2>
            <Badge variant="outline" className="text-xs border-cyan-500/20 text-cyan-400">
              Anything except army, killing, fraud
            </Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {unrestrictedRooms.map((room) => (
              <RoomCard key={room.id} room={room} viewMode={viewMode} />
            ))}
          </div>
        </div>
      )}

      {/* All Rooms by Category */}
      <div className="px-6 py-4">
        <h2 className="text-lg font-bold text-white mb-4">All Rooms</h2>
        
        <div className="space-y-6">
          {ROOM_CATEGORIES.map((category) => {
            const label = ROOM_CATEGORY_LABELS[category]
            const categoryRooms = roomsByCategory[category]
            
            if (!categoryRooms || categoryRooms.length === 0) return null

            return (
              <div key={category}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">{label.icon}</span>
                  <h3 className="font-bold text-white">{label.label}</h3>
                  <span className="text-xs text-white/40">({categoryRooms.length} rooms)</span>
                  <span className="text-xs text-white/50 ml-2">{label.description}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                  {categoryRooms.map((room) => (
                    <RoomCard key={room.id} room={room} viewMode={viewMode} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Adult Rooms Section (only shown if adult rooms exist and user is verified) */}
      {adultRooms.length > 0 && (
        <div className="px-6 py-4 border-t border-stone-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-rose-400">Adult Rooms (18+)</h2>
            <AdultRoomWarning />
          </div>
          <p className="text-xs text-white/40 mb-3">
            Adult rooms have FIXED models that cannot be changed for safety and consistency.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {adultRooms.map((room) => (
              <RoomCard key={room.id} room={room} viewMode={viewMode} />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {filteredRooms.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center p-12">
          <div className="w-20 h-20 rounded-full bg-stone-900 flex items-center justify-center mb-6">
            <Users size={40} className="text-white/20" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">No rooms found</h3>
          <p className="text-white/60 text-center mb-4">
            Try adjusting your search or filters. Remember: rooms are topics, not people.
          </p>
          <Button variant="outline" onClick={() => {
            setSearchQuery("")
            setSelectedCategory(null)
          }}>
            Clear Filters
          </Button>
        </div>
      )}
    </div>
  )
}

// Room Card Component
function RoomCard({ room, viewMode }: { room: Room; viewMode: "grid" | "list" }) {
  const isGrid = viewMode === "grid"

  return (
    <Link
      href={`/app/rooms/${room.id}`}
      className={`
        group rounded-xl border border-stone-800 bg-stone-900/50
        hover:border-purple-500/30 hover:bg-stone-800/50
        transition-all overflow-hidden
        ${isGrid ? "flex flex-col" : "flex items-center gap-4 p-4"}
      `}
    >
      {/* Room Header */}
      <div className={`flex items-start gap-3 p-4 ${isGrid ? "pb-0" : "flex-1 min-w-0"}`}>
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 flex items-center justify-center shrink-0">
          <span className="text-lg">{room.icon || "🎭"}</span>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="font-bold text-white group-hover:text-purple-400 transition-colors truncate">
              {room.name}
            </h3>
            {room.adult && <AdultRoomWarning />}
            {room.restrictions?.unrestricted && <UnrestrictedRoomBadge />}
            {room.premium && <PremiumModelBadge />}
          </div>
          <p className="text-xs text-white/60 line-clamp-2">{room.tagline}</p>
          <p className="text-[10px] text-white/40 mt-0.5">
            Topic: {room.topic}
          </p>
        </div>
      </div>

      {/* Room Details */}
      {isGrid && (
        <>
          <div className="px-4 pb-3">
            <p className="text-xs text-white/50 line-clamp-2">{room.description}</p>
          </div>
          
          {/* Room Footer */}
          <div className="flex items-center justify-between p-3 pt-0 border-t border-stone-800/50">
            <div className="flex gap-1 flex-wrap">
              {/* Models in this room */}
              <RoomModelInfo personas={room.personas} />
              
              {/* Room badges */}
              {room.featured && (
                <Badge variant="outline" className="text-xs border-amber-500/20 text-amber-400">
                  Featured
                </Badge>
              )}
              {room.popular && (
                <Badge variant="outline" className="text-xs border-purple-500/20 text-purple-400">
                  Popular
                </Badge>
              )}
              {room.new && (
                <Badge variant="outline" className="text-xs border-cyan-500/20 text-cyan-400">
                  New
                </Badge>
              )}
            </div>
            <ArrowRight size={14} className="text-white/0 group-hover:text-purple-400 transition-colors" />
          </div>
        </>
      )}

      {!isGrid && (
        <div className="flex items-center gap-2">
          <RoomModelInfo personas={room.personas} />
          <ArrowRight size={14} className="text-white/0 group-hover:text-purple-400 transition-colors" />
        </div>
      )}
    </Link>
  )
}

// Room Category Navigation
export function RoomCategoryNav({
  selectedCategory,
  onSelect,
}: {
  selectedCategory?: string
  onSelect?: (category: string) => void
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      <button
        onClick={() => onSelect?.("all")}
        className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
          !selectedCategory || selectedCategory === "all"
            ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
            : "bg-stone-900 text-white/60 border border-stone-800 hover:bg-stone-800/50"
        }`}
      >
        All Rooms
      </button>
      {ROOM_CATEGORIES.map((category) => {
        const label = ROOM_CATEGORY_LABELS[category]
        return (
          <button
            key={category}
            onClick={() => onSelect?.(category)}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1 ${
              selectedCategory === category
                ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                : "bg-stone-900 text-white/60 border border-stone-800 hover:bg-stone-800/50"
            }`}
          >
            {label.icon} {label.label}
          </button>
        )
      })}
    </div>
  )
}

// Room Grid Component
export function RoomGrid({
  rooms,
  onRoomSelect,
}: {
  rooms?: Room[]
  onRoomSelect?: (room: Room) => void
}) {
  const displayRooms = rooms || ROOMS

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {displayRooms.map((room) => (
        <RoomCard key={room.id} room={room} viewMode="grid" />
      ))}
    </div>
  )
}

// Quick Room Access for specific use cases
export function QuickRoomAccess() {
  // Quick access to key rooms
  const quickRooms = [
    { id: "unrestricted-lab", label: "Unrestricted", icon: "🚀" },
    { id: "trading-arena", label: "Trading", icon: "📈" },
    { id: "ai-sandbox", label: "Deep AI", icon: "🤖" },
    { id: "social-lounge", label: "Social", icon: "👥" },
    { id: "hacking-academy", label: "Hacking", icon: "🔓" },
  ]

  return (
    <div className="flex gap-2 flex-wrap">
      {quickRooms.map(({ id, label, icon }) => {
        const room = ROOMS.find(r => r.id === id)
        if (!room) return null
        
        return (
          <Link
            key={id}
            href={`/app/rooms/${id}`}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-stone-900/50 border border-stone-800 hover:bg-stone-800/50 hover:border-purple-500/20 transition-all text-sm font-medium text-white/80 hover:text-white"
          >
            <span>{icon}</span>
            <span>{label}</span>
          </Link>
        )
      })}
    </div>
  )
}

// Room Information Panel
export function RoomInfoPanel({ room }: { room: Room }) {
  return (
    <div className="bg-stone-900/50 border border-stone-800 rounded-xl p-6">
      <div className="flex items-start gap-4 mb-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 flex items-center justify-center">
          <span className="text-xl">{room.icon || "🎭"}</span>
        </div>
        <div>
          <h3 className="font-bold text-white text-lg">{room.name}</h3>
          <p className="text-white/60 text-sm">{room.tagline}</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Topic */}
        <div>
          <h4 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-1">Topic</h4>
          <p className="text-white">{room.topic}</p>
        </div>

        {/* Description */}
        <div>
          <h4 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-1">Description</h4>
          <p className="text-white/80 text-sm">{room.description}</p>
        </div>

        {/* Personas */}
        <div>
          <h4 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-1">Personas in this room</h4>
          <div className="flex gap-2 flex-wrap">
            {room.personas.map((persona) => (
              <div key={persona.name} className="flex items-center gap-1 bg-stone-800/50 px-2 py-1 rounded-lg text-xs">
                <span className="font-medium text-white">{persona.name}</span>
                <span className="text-white/50">- {persona.role}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Models */}
        <div>
          <h4 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-1">AI Models</h4>
          <RoomModelInfo personas={room.personas} />
          {room.restrictions?.modelChangeAllowed === false && (
            <p className="text-[10px] text-white/40 mt-1">Models are fixed for this room</p>
          )}
        </div>

        {/* Restrictions */}
        <div>
          <h4 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-1">Restrictions</h4>
          <div className="flex gap-1 flex-wrap">
            {room.restrictions?.unrestricted && (
              <Badge variant="outline" className="text-xs border-cyan-500/20 text-cyan-400">
                Unrestricted (except army, killing, fraud)
              </Badge>
            )}
            {room.adult && (
              <AdultRoomWarning />
            )}
            {room.premium && (
              <PremiumModelBadge />
            )}
            {room.restrictions?.premiumModelRequired && (
              <Badge variant="outline" className="text-xs border-amber-500/20 text-amber-400">
                Premium Model Required
              </Badge>
            )}
          </div>
          <p className="text-[10px] text-white/40 mt-1">
            Teaching first, then support in implementation
          </p>
        </div>

        {/* Teaching Ratio */}
        <div>
          <h4 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-1">Approach</h4>
          <div className="flex items-center gap-2">
            <div className="w-full h-2 bg-stone-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-cyan-500 to-purple-500"
                style={{ width: `${room.teachingRatio || 70}%` }}
              />
            </div>
            <span className="text-xs text-white/60 whitespace-nowrap">
              {room.teachingRatio || 70}% Teaching
            </span>
          </div>
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-stone-800 flex items-center justify-between">
        <Link
          href={`/app/rooms/${room.id}`}
          className="flex items-center gap-2 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
        >
          <ArrowRight size={14} />
          Enter Room
        </Link>
        
        <div className="flex gap-1">
          {room.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs border-stone-700 text-stone-400">
              {tag}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  )
}
