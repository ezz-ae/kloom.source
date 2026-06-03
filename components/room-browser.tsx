"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { Search, Grid3X3, List, Filter, ArrowRight, Users, Sparkles, Bot, Flame, TrendingUp } from "lucide-react"
import { ROOMS, type Room, ROOM_CATEGORIES, ROOM_CATEGORY_LABELS } from "@/lib/rooms"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ModelBadge } from "@/components/model-selector"

// Room Browser Component
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
          room.keywords?.some((kw) => kw.toLowerCase().includes(query))
      )
    }

    // Filter by category
    if (selectedCategory) {
      result = result.filter((room) => room.category === selectedCategory)
    }

    return result
  }, [searchQuery, selectedCategory])

  // Get popular rooms
  const popularRooms = useMemo(() => {
    return filteredRooms.filter((room) => room.popular).slice(0, 6)
  }, [filteredRooms])

  // Get rooms by category
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
    return filteredRooms.filter((room) => room.featured).slice(0, 4)
  }, [filteredRooms])

  return (
    <div className="flex flex-col h-full bg-stone-950">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-stone-800">
        <div>
          <h1 className="text-2xl font-black text-white">Rooms</h1>
          <p className="text-white/60 mt-1">Multi-AI conversations</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}>
            {viewMode === "grid" ? <Grid3X3 size={16} /> : <List size={16} />}
          </Button>
          <Button size="sm">
            <Filter size={16} className="mr-2" />
            Filter
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="p-6">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <Input
            type="text"
            placeholder="Search rooms..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-stone-900 border-stone-800 text-white"
          />
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
                {label.icon} {label.label}
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
            <h2 className="text-lg font-bold text-white">Featured</h2>
            <Link href="#all" className="text-xs font-medium text-cyan-400 hover:text-cyan-300">
              See all
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {featuredRooms.map((room) => (
              <RoomCard key={room.id} room={room} viewMode={viewMode} />
            ))}
          </div>
        </div>
      )}

      {/* Popular Rooms */}
      {popularRooms.length > 0 && (
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">Popular</h2>
            <Badge variant="outline" className="text-xs border-cyan-500/20 text-cyan-400">
              Trending
            </Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {popularRooms.map((room) => (
              <RoomCard key={room.id} room={room} viewMode={viewMode} />
            ))}
          </div>
        </div>
      )}

      {/* All Rooms by Category */}
      <div id="all" className="px-6 py-4">
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
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  {categoryRooms.map((room) => (
                    <RoomCard key={room.id} room={room} viewMode={viewMode} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Empty State */}
      {filteredRooms.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center p-12">
          <div className="w-20 h-20 rounded-full bg-stone-900 flex items-center justify-center mb-6">
            <Users size={40} className="text-white/20" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">No rooms found</h3>
          <p className="text-white/60 text-center mb-4">
            Try adjusting your search or filters
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
      onClick={(e) => {
        // Allow for custom onSelect handling
        if (e.ctrlKey || e.metaKey) return
      }}
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
          {room.icon || <Users size={20} className="text-purple-400" />}
        </div>
        <div className="min-w-0">
          <h3 className="font-bold text-white group-hover:text-purple-400 transition-colors truncate">
            {room.name}
          </h3>
          <p className="text-xs text-white/60 mt-0.5 line-clamp-2">{room.tagline}</p>
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
            <div className="flex gap-1">
              {room.models && room.models.length > 0 && (
                <div className="flex gap-1">
                  {room.models.slice(0, 3).map((model) => (
                    <ModelBadge key={model} backend={model as Backend} size="sm" />
                  ))}
                  {room.models.length > 3 && (
                    <Badge variant="outline" className="text-xs border-stone-700 text-stone-400">
                      +{room.models.length - 3}
                    </Badge>
                  )}
                </div>
              )}
              {room.adult && (
                <Badge variant="outline" className="text-xs border-rose-500/20 text-rose-400">
                  18+
                </Badge>
              )}
              {room.popular && (
                <Badge variant="outline" className="text-xs border-amber-500/20 text-amber-400">
                  Popular
                </Badge>
              )}
            </div>
            <ArrowRight size={14} className="text-white/0 group-hover:text-purple-400 transition-colors" />
          </div>
        </>
      )}

      {!isGrid && (
        <div className="flex items-center gap-2">
          {room.models && room.models.length > 0 && (
            <div className="flex gap-1">
              {room.models.slice(0, 2).map((model) => (
                <ModelBadge key={model} backend={model as Backend} size="sm" />
              ))}
            </div>
          )}
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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {displayRooms.map((room) => (
        <RoomCard key={room.id} room={room} viewMode="grid" />
      ))}
    </div>
  )
}
