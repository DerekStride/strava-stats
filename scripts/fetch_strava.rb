#!/usr/bin/env ruby
# frozen_string_literal: true

require 'strava-ruby-client'
require 'json'
require 'time'

METERS_TO_MILES = 0.000621371
METERS_TO_FEET = 3.28084

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

  # Fetch activities from the past 365 days
  cutoff_time = Time.now - (365 * 24 * 60 * 60)
  activities = fetch_all_activities(client, after: cutoff_time.to_i)

  # Aggregate stats by activity type
  stats = aggregate_stats(activities)

  # Write output
  output = {
    generated_at: Time.now.utc.iso8601,
    period: 'last_365_days',
    by_type: stats[:by_type],
    totals: stats[:totals]
  }

  output_path = File.join(__dir__, '..', 'data', 'stats.json')
  File.write(output_path, JSON.pretty_generate(output))

  puts "Wrote stats to #{output_path}"
  puts "Total activities: #{stats[:totals][:count]}"
end

def fetch_all_activities(client, after:)
  activities = []

  client.athlete_activities(per_page: 100, after: after) do |activity|
    activities << activity
  end

  activities
end

def aggregate_stats(activities)
  by_type = Hash.new { |h, k| h[k] = { count: 0, distance_miles: 0.0, moving_time_hours: 0.0, elevation_gain_feet: 0.0 } }

  activities.each do |activity|
    type = activity.type
    by_type[type][:count] += 1
    by_type[type][:distance_miles] += (activity.distance || 0) * METERS_TO_MILES
    by_type[type][:moving_time_hours] += (activity.moving_time || 0) / 3600.0
    by_type[type][:elevation_gain_feet] += (activity.total_elevation_gain || 0) * METERS_TO_FEET
  end

  # Round values
  by_type.each do |_type, stats|
    stats[:distance_miles] = stats[:distance_miles].round(1)
    stats[:moving_time_hours] = stats[:moving_time_hours].round(2)
    stats[:elevation_gain_feet] = stats[:elevation_gain_feet].round(0).to_i
  end

  # Calculate totals
  totals = {
    count: 0,
    distance_miles: 0.0,
    moving_time_hours: 0.0,
    elevation_gain_feet: 0
  }

  by_type.each_value do |stats|
    totals[:count] += stats[:count]
    totals[:distance_miles] += stats[:distance_miles]
    totals[:moving_time_hours] += stats[:moving_time_hours]
    totals[:elevation_gain_feet] += stats[:elevation_gain_feet]
  end

  totals[:distance_miles] = totals[:distance_miles].round(1)
  totals[:moving_time_hours] = totals[:moving_time_hours].round(2)

  # Sort by_type by count descending
  sorted_by_type = by_type.sort_by { |_k, v| -v[:count] }.to_h

  { by_type: sorted_by_type, totals: totals }
end

main if __FILE__ == $PROGRAM_NAME
