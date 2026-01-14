#!/usr/bin/env ruby
# frozen_string_literal: true

require 'json'
require 'date'

MONTH_NAMES = %w[Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec].freeze
DAY_ABBREV = %w[S M T W T F S].freeze

# Map Strava sport types to Lucide icon names
ACTIVITY_ICONS = {
  'Run' => 'footprints',
  'Ride' => 'bike',
  'WeightTraining' => 'dumbbell',
  'Swim' => 'waves',
  'Yoga' => 'flower-2',
  'Hike' => 'mountain',
  'Walk' => 'footprints',
  'Workout' => 'heart-pulse',
  'Squash' => 'circle-dot',
  'VirtualRide' => 'bike',
  'VirtualRun' => 'footprints'
}.freeze

DEFAULT_ICON = 'activity'

def main
  # Read stats
  stats_path = File.join(__dir__, '..', 'data', 'stats.json')
  stats = JSON.parse(File.read(stats_path), symbolize_names: true)

  # Group activities by year and month
  by_year = group_activities(stats[:activities])

  # Current date
  now = Time.now
  current_year = now.year
  current_month = now.month

  # All years we have data for
  all_years = by_year.keys.sort.reverse

  # Ensure current year exists (even if empty)
  by_year[current_year] ||= {}

  # Calculate year stats
  year_stats = calculate_year_stats(stats[:activities])

  # Generate index.html (current year)
  index_html = render_page(
    year: current_year,
    months: by_year[current_year],
    totals: stats[:totals],
    year_stats: year_stats[current_year] || empty_stats,
    all_years: all_years,
    current_year: current_year,
    current_month: current_month,
    is_current_year: true,
    generated_at: stats[:generated_at]
  )
  write_file('index.html', index_html)

  # Generate pages for each past year
  all_years.each do |year|
    next if year == current_year

    html = render_page(
      year: year,
      months: by_year[year],
      totals: stats[:totals],
      year_stats: year_stats[year] || empty_stats,
      all_years: all_years,
      current_year: current_year,
      current_month: current_month,
      is_current_year: false,
      generated_at: stats[:generated_at]
    )
    write_file("#{year}.html", html)
  end

  puts "Generated #{all_years.size} pages"
end

def write_file(filename, content)
  output_path = File.join(__dir__, '..', 'docs', filename)
  File.write(output_path, content)
  puts "Wrote #{output_path}"
end

def group_activities(activities)
  by_year = {}

  activities.each do |activity|
    date = Date.parse(activity[:date])
    year = date.year
    month = date.month
    day = date.day

    by_year[year] ||= {}
    by_year[year][month] ||= {}
    by_year[year][month][day] ||= []
    by_year[year][month][day] << activity
  end

  by_year
end

def calculate_year_stats(activities)
  stats = {}

  activities.each do |activity|
    year = Date.parse(activity[:date]).year
    type = activity[:type]
    stats[year] ||= empty_stats

    stats[year][:count] += 1
    stats[year][:moving_time_hours] += activity[:moving_time_minutes] / 60.0

    # Track by type
    stats[year][:by_type][type] ||= { count: 0, distance_km: 0.0, elevation_gain_meters: 0, moving_time_hours: 0.0 }
    stats[year][:by_type][type][:count] += 1
    stats[year][:by_type][type][:distance_km] += activity[:distance_km]
    stats[year][:by_type][type][:elevation_gain_meters] += activity[:elevation_gain_meters]
    stats[year][:by_type][type][:moving_time_hours] += activity[:moving_time_minutes] / 60.0
  end

  # Round values
  stats.each do |_year, s|
    s[:moving_time_hours] = s[:moving_time_hours].round(2)
    s[:by_type].each do |_type, t|
      t[:distance_km] = t[:distance_km].round(1)
      t[:moving_time_hours] = t[:moving_time_hours].round(1)
    end
  end

  stats
end

def empty_stats
  { count: 0, moving_time_hours: 0.0, by_type: {} }
end

# Activity types to show distance/elevation for
DISTANCE_TYPES = %w[Run Ride].freeze

# Activity types to show count/duration for
DURATION_TYPES = %w[WeightTraining].freeze

def render_page(year:, months:, totals:, year_stats:, all_years:, current_year:, current_month:, is_current_year:, generated_at:)
  # For current year, only show months up to current month
  months_to_show = is_current_year ? (1..current_month) : (1..12)

  <<~HTML
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>#{year} - Strava Stats</title>
      <link rel="stylesheet" href="style.css">
    </head>
    <body>
      <h1>#{year}</h1>
      <p class="updated">Updated #{format_date(generated_at)}</p>

      #{render_year_links(all_years: all_years, current_year: current_year, page_year: year)}

      #{render_year_stats(year_stats, is_current_year)}

      <div class="months-grid">
        #{months_to_show.map { |m| render_month(year, m, months[m] || {}) }.join("\n")}
      </div>

      #{render_footer(totals: totals)}

      <script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>
      <script>lucide.createIcons();</script>
    </body>
    </html>
  HTML
end

def render_year_stats(year_stats, is_current_year)
  label = is_current_year ? 'Year to Date' : 'Total'
  type_stats = render_type_stats(year_stats[:by_type])

  <<~HTML
    <div class="year-stats">
      <div class="stat-block">
        <span class="stat-block-label">#{label}</span>
        <span class="stat-block-values"><span class="stat-value">#{year_stats[:count]}</span><span class="stat-label">activities</span> <span class="stat-value">#{format_hours(year_stats[:moving_time_hours])}</span><span class="stat-label">hours</span></span>
      </div>
      #{type_stats}
    </div>
  HTML
end

def render_type_stats(by_type)
  return '' if by_type.nil? || by_type.empty?

  # Convert keys to strings for consistent access
  by_type_str = by_type.transform_keys(&:to_s)

  stats_parts = []

  # Order: WeightTraining first, Run second, Ride last
  ordered_types = DURATION_TYPES + DISTANCE_TYPES

  ordered_types.each do |type|
    next unless by_type_str[type]

    t = by_type_str[type]
    count = t[:count] || t['count'] || 0
    next if count < 1

    display_name = format_type_name(type)

    if DURATION_TYPES.include?(type)
      # Duration-based: count + hours
      hours = t[:moving_time_hours] || t['moving_time_hours'] || 0
      stats_parts << "<span class=\"type-stat\"><span class=\"type-name\">#{display_name}</span><span class=\"type-stat-values\"><span class=\"stat-value\">#{count}</span><span class=\"stat-label\">sessions</span> <span class=\"stat-value\">#{format_hours(hours)}</span><span class=\"stat-label\">hours</span></span></span>"
    else
      # Distance-based: count + km + elevation
      dist = t[:distance_km] || t['distance_km'] || 0
      next if dist < 1 # Skip if negligible distance

      elev = t[:elevation_gain_meters] || t['elevation_gain_meters'] || 0
      elevation_part = elev > 0 ? " <span class=\"stat-value\">#{format_number(elev)}</span><span class=\"stat-label\">m</span>" : ''
      stats_parts << "<span class=\"type-stat\"><span class=\"type-name\">#{display_name}</span><span class=\"type-stat-values\"><span class=\"stat-value\">#{count}</span><span class=\"stat-label\">sessions</span> <span class=\"stat-value\">#{format_number(dist)}</span><span class=\"stat-label\">km</span>#{elevation_part}</span></span>"
    end
  end

  return '' if stats_parts.empty?

  stats_parts.join("\n    ")
end

def format_type_name(type)
  # Add spaces to camelCase names
  type.gsub(/([a-z])([A-Z])/, '\1 \2')
end

def render_month(year, month, days)
  first_day = Date.new(year, month, 1)
  days_in_month = Date.new(year, month, -1).day
  start_weekday = first_day.wday

  <<~HTML
    <div class="month">
      <div class="month-header">#{MONTH_NAMES[month - 1]}</div>
      <div class="calendar">
        #{DAY_ABBREV.map { |d| "<div class=\"calendar-header\">#{d}</div>" }.join}
        #{render_calendar_days(start_weekday, days_in_month, days)}
      </div>
    </div>
  HTML
end

def render_calendar_days(start_weekday, days_in_month, activity_days)
  cells = []

  # Empty cells for padding
  start_weekday.times { cells << '<div class="day empty"></div>' }

  # Day cells
  (1..days_in_month).each do |day|
    if activity_days[day]
      activities = activity_days[day]
      # Get the primary activity type (first one, or could prioritize)
      primary_type = activities.first[:type]
      icon_name = ACTIVITY_ICONS[primary_type] || DEFAULT_ICON

      # Show count badge if multiple activities
      badge = activities.size > 1 ? "<span class=\"badge\">#{activities.size}</span>" : ''

      types_list = activities.map { |a| a[:type] }.join(', ')
      cells << "<div class=\"day has-activity\"><i data-lucide=\"#{icon_name}\"></i>#{badge}<span class=\"tooltip\">#{types_list}</span></div>"
    else
      cells << "<div class=\"day\">#{day}</div>"
    end
  end

  cells.join("\n        ")
end

def render_year_links(all_years:, current_year:, page_year:)
  year_links = all_years.map do |y|
    href = y == current_year ? 'index.html' : "#{y}.html"
    css_class = y == page_year ? 'current' : ''
    "<a href=\"#{href}\" class=\"#{css_class}\">#{y}</a>"
  end.join("\n        ")

  <<~HTML
    <div class="year-links">
        <div class="year-links-label">Years</div>
        #{year_links}
      </div>
  HTML
end

def render_footer(totals:)
  <<~HTML
    <footer>
      <div class="totals">
        <div class="stat-block">
          <span class="stat-block-label">All Time</span>
          <span class="stat-block-values"><span class="stat-value">#{totals[:count]}</span><span class="stat-label">activities</span> <span class="stat-value">#{format_hours(totals[:moving_time_hours])}</span><span class="stat-label">hours</span></span>
        </div>
        #{render_type_stats(totals[:by_type])}
      </div>
    </footer>
  HTML
end

def format_date(iso_date)
  date = Date.parse(iso_date)
  date.strftime('%B %d, %Y')
end

def format_number(num)
  num.to_i.to_s.reverse.gsub(/(\d{3})(?=\d)/, '\\1,').reverse
end

def format_hours(hours)
  hours.round(0).to_i
end

main if __FILE__ == $PROGRAM_NAME
