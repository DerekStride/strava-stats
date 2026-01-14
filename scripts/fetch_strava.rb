#!/usr/bin/env ruby
# frozen_string_literal: true

require 'strava-ruby-client'
require 'json'
require 'time'

METERS_TO_KM = 0.001

def main
  # Get access token using refresh token
  oauth_client = Strava::OAuth::Client.new(
    client_id: ENV.fetch('STRAVA_CLIENT_ID'),
    client_secret: ENV.fetch('STRAVA_CLIENT_SECRET')
  )

  response = oauth_client.oauth_token(
    refresh_token: ENV.fetch('STRAVA_REFRESH_TOKEN'),
    grant_type: 'refresh_token'
  )

  # Create API client
  client = Strava::Api::Client.new(access_token: response.access_token)

  # Fetch all activities
  raw_activities = fetch_all_activities(client)
  puts "Fetched #{raw_activities.length} activities"

  # Transform to simple format
  activities = raw_activities.map { |a| transform_activity(a) }

  # Sort by date descending (most recent first)
  activities.sort_by! { |a| a[:date] }.reverse!

  # Calculate totals
  totals = calculate_totals(raw_activities)

  # Write output
  output = {
    generated_at: Time.now.utc.iso8601,
    activities: activities,
    totals: totals
  }

  output_path = File.join(__dir__, '..', 'data', 'stats.json')
  File.write(output_path, JSON.pretty_generate(output))

  puts "Wrote stats to #{output_path}"
  puts "Total activities: #{totals[:count]}"
end

def fetch_all_activities(client)
  activities = []

  client.athlete_activities(per_page: 100) do |activity|
    activities << activity
  end

  activities
end

def transform_activity(activity)
  {
    date: activity.start_date_local.strftime('%Y-%m-%d'),
    type: activity.sport_type,
    name: activity.name,
    distance_km: ((activity.distance || 0) * METERS_TO_KM).round(1),
    moving_time_minutes: ((activity.moving_time || 0) / 60.0).round(0),
    elevation_gain_meters: (activity.total_elevation_gain || 0).round(0)
  }
end

def calculate_totals(activities)
  totals = {
    count: 0,
    distance_km: 0.0,
    moving_time_hours: 0.0,
    elevation_gain_meters: 0,
    by_type: {}
  }

  activities.each do |activity|
    type = activity.sport_type
    distance = (activity.distance || 0) * METERS_TO_KM
    time = (activity.moving_time || 0) / 3600.0
    elevation = (activity.total_elevation_gain || 0).round(0)

    totals[:count] += 1
    totals[:distance_km] += distance
    totals[:moving_time_hours] += time
    totals[:elevation_gain_meters] += elevation

    totals[:by_type][type] ||= { count: 0, distance_km: 0.0, moving_time_hours: 0.0, elevation_gain_meters: 0 }
    totals[:by_type][type][:count] += 1
    totals[:by_type][type][:distance_km] += distance
    totals[:by_type][type][:moving_time_hours] += time
    totals[:by_type][type][:elevation_gain_meters] += elevation
  end

  # Round values
  totals[:distance_km] = totals[:distance_km].round(1)
  totals[:moving_time_hours] = totals[:moving_time_hours].round(2)
  totals[:by_type].each do |_type, stats|
    stats[:distance_km] = stats[:distance_km].round(1)
    stats[:moving_time_hours] = stats[:moving_time_hours].round(2)
  end

  # Sort by_type by count descending
  totals[:by_type] = totals[:by_type].sort_by { |_k, v| -v[:count] }.to_h

  totals
end

main if __FILE__ == $PROGRAM_NAME
