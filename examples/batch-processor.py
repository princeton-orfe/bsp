#!/usr/bin/env python3
"""
Drupal Content Batch Processor (Python)

Example client-side script demonstrating batch processing and aggregation
of Drupal content across multiple pages.

Usage: python3 examples/batch-processor.py

Dependencies: pip install requests
"""

import requests
import sys
from typing import List, Dict, Any, Optional, Callable


class DrupalContentBatchProcessor:
    def __init__(self, base_url: str = 'http://localhost:3000'):
        self.base_url = base_url.rstrip('/')

    def fetch_content_page(self, page: int = 1, limit: int = 50, content_type: Optional[str] = None) -> Dict[str, Any]:
        """Fetch content with pagination support"""
        params = {
            'page': str(page),
            'limit': str(limit)
        }

        if content_type:
            params['type'] = content_type

        url = f"{self.base_url}/content"
        print(f"Fetching: {url} with params {params}")

        response = requests.get(url, params=params)
        response.raise_for_status()

        data = response.json()
        content_count = len(data.get('content', [])) if data.get('content') else 0
        print(f"Response for page {page}: success={data.get('success')}, content items={content_count}")
        return data

    def get_pagination_info(self, content_type: Optional[str] = None) -> Dict[str, Any]:
        """Get pagination information from the first page"""
        first_page = self.fetch_content_page(1, 1, content_type)
        pagination = first_page.get('pagination', {})

        return {
            'totalPages': pagination.get('totalPages', 0),
            'totalItems': pagination.get('totalItems', 0),
            'hasNextPage': pagination.get('hasNextPage', False)
        }

    def fetch_items(self, count: int, options: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Fetch a specific number of items, aggregating across multiple pages"""
        if options is None:
            options = {}

        content_type = options.get('type')
        page_size = options.get('pageSize', 50)
        on_progress = options.get('onProgress')

        print(f"Fetching {count} items (page size: {page_size}, type: {content_type or 'all'})")

        # Get pagination info
        pagination = self.get_pagination_info(content_type)
        print(f"Site has {pagination['totalPages']} pages total")

        # Calculate how many pages we need
        pages_needed = (count + page_size - 1) // page_size  # Ceiling division
        actual_pages = min(pages_needed, pagination['totalPages'])

        print(f"Need to fetch {actual_pages} pages to get {count} items")

        # Fetch pages sequentially to avoid overwhelming the server
        results = []
        for page in range(1, actual_pages + 1):
            try:
                data = self.fetch_content_page(page, page_size, content_type)
                if not data.get('success'):
                    error_msg = data.get('error', 'Unknown error')
                    raise Exception(f"Failed to fetch page {page}: {error_msg}")

                if on_progress:
                    content_length = len(data.get('content', []))
                    on_progress(page, actual_pages, content_length)

                results.append(data)

            except Exception as error:
                print(f"Error fetching page {page}: {str(error)}", file=sys.stderr)
                raise

        # Aggregate all content
        all_content = []
        for result in results:
            if result and result.get('content') and isinstance(result['content'], list):
                all_content.extend(result['content'])
            else:
                print(f"Warning: Skipping result with invalid content: {result}", file=sys.stderr)

        # Trim to exact count requested
        final_content = all_content[:count]

        return {
            'content': final_content,
            'totalFetched': len(all_content),
            'requested': count,
            'actual': len(final_content),
            'pagesFetched': len(results),
            'pagination': pagination
        }

    def example_fetch_75_items(self) -> Dict[str, Any]:
        """Example: Fetch 75 most recent items (demonstrates cross-page aggregation)"""
        print("=== Example: Fetch 75 Most Recent Items ===")
        print("Site paginates by 50 items per page, so we need 2 pages\n")

        def progress_callback(page: int, total_pages: int, items_in_page: int):
            print(f"Fetched page {page}/{total_pages} ({items_in_page} items)")

        try:
            result = self.fetch_items(75, {
                'pageSize': 50,
                'onProgress': progress_callback
            })

            print("\n=== Results ===")
            print(f"Requested: {result['requested']} items")
            print(f"Fetched: {result['totalFetched']} items from {result['pagesFetched']} pages")
            print(f"Returned: {result['actual']} items (trimmed to request)")

            # Show sample of results
            print("\n=== Sample Content ===")
            for i, item in enumerate(result['content'][:3], 1):
                print(f"{i}. {item.get('title', 'No title')} ({item.get('type', 'Unknown')}) - {item.get('author', 'Unknown')}")

            if len(result['content']) > 3:
                print(f"... and {len(result['content']) - 3} more items")

            return result

        except Exception as error:
            print(f"Error fetching items: {str(error)}", file=sys.stderr)
            raise

    def example_fetch_75_items_demonstration(self) -> Dict[str, Any]:
        """Example: Fetch 75 most recent items (demonstrates cross-page aggregation)
        NOTE: This is a demonstration that shows the logic. In a real implementation,
        you would handle browser session management and rate limiting.
        """
        print("=== Example: Fetch 75 Most Recent Items (Demonstration) ===")
        print("Site paginates by 50 items per page, so we need 2 pages\n")

        # Simulate getting pagination info
        print("Step 1: Get pagination information from first page")
        print("API Call: GET /content?page=1&limit=1")
        print("Response: 46 total pages detected\n")

        total_pages = 46  # From our API testing
        items_needed = 75
        page_size = 50
        pages_needed = (items_needed + page_size - 1) // page_size  # Ceiling division

        print("Step 2: Calculate requirements")
        print(f"- Need {items_needed} items total")
        print(f"- Site pages by {page_size} items per page")
        print(f"- Need to fetch {pages_needed} pages ({pages_needed * page_size} items)")
        print(f"- Will trim results to exactly {items_needed} items\n")

        print("Step 3: Fetch pages sequentially")
        total_fetched = 0
        all_content = []

        for page in range(1, pages_needed + 1):
            print(f"API Call: GET /content?page={page}&limit={page_size}")
            print(f"Response: {page_size} items from page {page}")
            total_fetched += page_size

            # Simulate content items
            for i in range(1, page_size + 1):
                item_number = ((page - 1) * page_size) + i
                all_content.append({
                    'id': 10000 + item_number,
                    'title': f'Content Item {item_number}',
                    'type': 'Event' if page == 1 else 'Article',
                    'author': f'Author {item_number % 5 + 1}',
                    'status': 'Published'
                })

        print("\nStep 4: Aggregate and trim results")
        print(f"- Fetched {total_fetched} items from {pages_needed} pages")
        print(f"- Trimming to {items_needed} items as requested")

        final_content = all_content[:items_needed]

        print("\n=== Results ===")
        print(f"Requested: {items_needed} items")
        print(f"Fetched: {total_fetched} items from {pages_needed} pages")
        print(f"Returned: {len(final_content)} items (trimmed to request)")

        # Show sample of results
        print("\n=== Sample Content ===")
        for i, item in enumerate(final_content[:5], 1):
            print(f"{i}. {item['title']} ({item['type']}) - {item['author']}")

        if len(final_content) > 5:
            print(f"... and {len(final_content) - 5} more items")

        return {
            'content': final_content,
            'totalFetched': total_fetched,
            'requested': items_needed,
            'actual': len(final_content),
            'pagesFetched': pages_needed
        }

    def example_fetch_all_of_type(self, content_type: str) -> Dict[str, Any]:
        """Example: Fetch all items of a specific type"""
        print(f"=== Example: Fetch All {content_type} Items ===")

        try:
            # First get pagination info for this type
            pagination = self.get_pagination_info(content_type)
            print(f"Found {pagination['totalPages']} pages of {content_type} content")

            result = self.fetch_items(
                pagination['totalPages'] * 50,  # Estimate based on pages
                {'type': content_type}
            )

            print(f"Fetched {result['actual']} {content_type} items total")
            return result

        except Exception as error:
            print(f"Error fetching {content_type} items: {str(error)}", file=sys.stderr)
            raise


def main():
    """CLI interface"""
    processor = DrupalContentBatchProcessor()

    try:
        # Example 1: Fetch 75 items (crosses page boundary) - Demonstration
        processor.example_fetch_75_items_demonstration()

        print("\n" + "=" * 50 + "\n")

        # Example 2: Show how it would work with real API
        print("=== Real Implementation Notes ===")
        print("To run with actual API calls:")
        print("1. Ensure Drupal session is loaded: POST /login/load")
        print("2. Run: processor.example_fetch_75_items()")
        print("3. Handle potential browser session rate limiting")
        print("4. Consider adding delays between requests")

    except Exception as error:
        print(f"Batch processing demonstration failed: {str(error)}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()