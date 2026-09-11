//! Opt-in synthetic benchmarks; no user history, clipboard, or content output.
use std::alloc::{GlobalAlloc, Layout, System};
use std::cell::Cell;
use std::hint::black_box;
use std::path::Path;
use std::time::Instant;

use super::{run_context, run_list, run_search};
use crate::history::{hash_hex, merge_history_result, HistoryEntry};
use crate::sensitive_content::classify_text;
use crate::text_transform::{perform_text_transform, TextTransformAction, TextTransformRequest};

thread_local! {
    static ALLOCATIONS: Cell<Option<(usize, usize)>> = const { Cell::new(None) };
}

struct CountingAllocator;

fn record_allocation(bytes: usize) {
    let _ = ALLOCATIONS.try_with(|counter| {
        if let Some((calls, total)) = counter.get() {
            counter.set(Some((calls + 1, total + bytes)));
        }
    });
}

unsafe impl GlobalAlloc for CountingAllocator {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        record_allocation(layout.size());
        System.alloc(layout)
    }

    unsafe fn dealloc(&self, ptr: *mut u8, layout: Layout) {
        System.dealloc(ptr, layout);
    }

    unsafe fn realloc(&self, ptr: *mut u8, layout: Layout, size: usize) -> *mut u8 {
        record_allocation(size);
        System.realloc(ptr, layout, size)
    }
}

#[global_allocator]
static ALLOCATOR: CountingAllocator = CountingAllocator;

fn measure<T>(name: &str, mut operation: impl FnMut() -> T) {
    black_box(operation());
    let mut samples = Vec::new();
    for _ in 0..5 {
        ALLOCATIONS.with(|counter| counter.set(Some((0, 0))));
        let started = Instant::now();
        for _ in 0..20 {
            black_box(operation());
        }
        let elapsed = started.elapsed().as_nanos() / 20;
        let (calls, bytes) = ALLOCATIONS.with(|counter| counter.replace(None).unwrap());
        samples.push(serde_json::json!({"nanos": elapsed, "allocations": calls / 20, "allocatedBytes": bytes / 20}));
    }
    println!(
        "MCLIP_BENCH {}",
        serde_json::json!({"name": name, "samples": samples})
    );
}

#[test]
#[ignore = "synthetic allocation/timing benchmark; run explicitly in release mode"]
fn synthetic_hot_paths() {
    let history: Vec<HistoryEntry> = (0..500)
        .map(|index| {
            serde_json::from_value(serde_json::json!({
            "kind":"text", "id":format!("fixture-{index}"),
            "text":"Fixture text 世界 ".repeat(256), "displayText":"Fixture text 世界 ".repeat(256),
            "firstCopiedAt":1, "lastCopiedAt":500-index, "copyCount":1,
            "sourceApp":null, "isPinned":false, "pinnedAt":null
        })).unwrap()
        })
        .collect();
    let list_args = vec!["--limit".into(), "500".into(), "--json".into()];
    let search_args = vec!["absent-needle".into(), "--json".into()];
    let context_args = vec!["--last".into(), "5".into()];
    let classification = "Ordinary fixture 世界 ".repeat(2000);
    let json = serde_json::to_string(&vec!["Fixture text 世界"; 256]).unwrap();
    measure("classify", || classify_text(black_box(&classification)));
    measure("hash", || {
        hash_hex(black_box(b"clipboard signature fixture"))
    });
    measure("search500", || {
        run_search(black_box(&history), &search_args).unwrap()
    });
    measure("listJson500", || {
        run_list(Path::new("unused"), black_box(&history), &list_args).unwrap()
    });
    measure("context5", || {
        run_context(black_box(&history), &context_args).unwrap()
    });
    measure("merge500IncludingInputClone", || {
        merge_history_result(history.clone(), history[250].clone(), 500)
    });
    measure("jsonMinifyIncludingInputClone", || {
        perform_text_transform(TextTransformRequest {
            action: TextTransformAction::JsonMinify,
            input: json.clone(),
        })
        .unwrap()
    });
}
