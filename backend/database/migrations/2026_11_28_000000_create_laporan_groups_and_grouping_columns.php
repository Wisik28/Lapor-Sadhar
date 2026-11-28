<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (! Schema::hasTable('laporan_groups')) {
            Schema::create('laporan_groups', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('primary_laporan_id')->nullable();
                $table->string('kategori_laporan', 50);
                $table->string('lokasi_kampus', 20)->nullable();
                $table->string('normalized_location', 255);
                $table->unsignedInteger('unique_reporter_count')->default(1);
                $table->unsignedInteger('total_laporan_count')->default(1);
                $table->boolean('is_escalated')->default(false);
                $table->timestamp('escalated_at')->nullable();
                $table->decimal('similarity_confidence', 4, 2)->nullable();
                $table->text('similarity_reason')->nullable();
                $table->timestamps();

                $table->index(['kategori_laporan', 'lokasi_kampus', 'normalized_location'], 'laporan_groups_lookup_idx');
                $table->index('is_escalated', 'laporan_groups_escalated_idx');
                $table->index('primary_laporan_id', 'laporan_groups_primary_idx');

                if (Schema::hasTable('laporan')) {
                    $table->foreign('primary_laporan_id', 'laporan_groups_primary_laporan_foreign')
                        ->references('id_laporan')
                        ->on('laporan')
                        ->nullOnDelete()
                        ->cascadeOnUpdate();
                }
            });
        }

        if (Schema::hasTable('laporan')) {
            Schema::table('laporan', function (Blueprint $table) {
                if (! Schema::hasColumn('laporan', 'group_id')) {
                    $table->unsignedBigInteger('group_id')->nullable()->after('skala_keparahan');
                    $table->index('group_id', 'laporan_group_id_idx');
                    $table->foreign('group_id', 'laporan_group_id_foreign')
                        ->references('id')
                        ->on('laporan_groups')
                        ->nullOnDelete()
                        ->cascadeOnUpdate();
                }
                if (! Schema::hasColumn('laporan', 'similarity_confidence')) {
                    $table->decimal('similarity_confidence', 4, 2)->nullable()->after('group_id');
                }
                if (! Schema::hasColumn('laporan', 'similarity_reason')) {
                    $table->text('similarity_reason')->nullable()->after('similarity_confidence');
                }
            });
        }

        if (Schema::hasTable('priority_assessments')) {
            Schema::table('priority_assessments', function (Blueprint $table) {
                if (! Schema::hasColumn('priority_assessments', 'is_group_escalated')) {
                    $table->boolean('is_group_escalated')->default(false)->after('needs_review');
                    $table->index('is_group_escalated', 'priority_assessments_group_escalated_idx');
                }
                if (! Schema::hasColumn('priority_assessments', 'group_unique_reporters')) {
                    $table->unsignedInteger('group_unique_reporters')->default(1)->after('is_group_escalated');
                }
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('priority_assessments')) {
            Schema::table('priority_assessments', function (Blueprint $table) {
                if (Schema::hasColumn('priority_assessments', 'is_group_escalated')) {
                    $table->dropIndex('priority_assessments_group_escalated_idx');
                    $table->dropColumn('is_group_escalated');
                }
                if (Schema::hasColumn('priority_assessments', 'group_unique_reporters')) {
                    $table->dropColumn('group_unique_reporters');
                }
            });
        }

        if (Schema::hasTable('laporan')) {
            Schema::table('laporan', function (Blueprint $table) {
                if (Schema::hasColumn('laporan', 'group_id')) {
                    $table->dropForeign('laporan_group_id_foreign');
                    $table->dropIndex('laporan_group_id_idx');
                    $table->dropColumn('group_id');
                }
                if (Schema::hasColumn('laporan', 'similarity_confidence')) {
                    $table->dropColumn('similarity_confidence');
                }
                if (Schema::hasColumn('laporan', 'similarity_reason')) {
                    $table->dropColumn('similarity_reason');
                }
            });
        }

        Schema::dropIfExists('laporan_groups');
    }
};

