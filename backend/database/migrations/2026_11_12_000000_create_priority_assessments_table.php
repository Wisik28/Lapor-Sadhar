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
        if (!Schema::hasTable('priority_assessments')) {
            Schema::create('priority_assessments', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('id_laporan')->unique();
                $table->foreign('id_laporan')
                    ->references('id_laporan')
                    ->on('laporan')
                    ->onDelete('cascade')
                    ->onUpdate('cascade');

                $table->string('kategori', 50)->default('Fasilitas');
                $table->string('severity_level', 30)->default('sedang'); // 'berat', 'sedang', 'ringan' (efektif)
                $table->string('severity_source', 30)->default('ai'); // 'ai', 'admin', 'rule_fallback'
                $table->string('ai_suggested_severity', 30)->default('sedang');
                $table->string('admin_severity', 30)->nullable();
                $table->unsignedInteger('priority_score')->default(0); // 0 - 100
                $table->string('priority_level', 30)->default('sedang'); // 'kritis', 'tinggi', 'sedang', 'rendah'
                $table->decimal('confidence', 4, 2)->default(0.80);
                $table->json('dimensions')->nullable();
                $table->json('safety_flags')->nullable();
                $table->json('reasons')->nullable();
                $table->boolean('needs_review')->default(true);
                $table->text('admin_notes')->nullable();
                $table->unsignedBigInteger('admin_id')->nullable();
                $table->timestamp('reviewed_at')->nullable();
                $table->timestamps();

                $table->index('priority_score');
                $table->index('priority_level');
                $table->index('severity_level');
                $table->index('needs_review');
            });
        }

        if (!Schema::hasTable('priority_feedback')) {
            Schema::create('priority_feedback', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('id_laporan');
                $table->foreign('id_laporan')
                    ->references('id_laporan')
                    ->on('laporan')
                    ->onDelete('cascade')
                    ->onUpdate('cascade');

                $table->unsignedBigInteger('admin_id')->nullable();
                $table->string('original_level', 30);
                $table->string('corrected_level', 30);
                $table->text('note')->nullable();
                $table->timestamps();

                $table->index('id_laporan');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('priority_feedback');
        Schema::dropIfExists('priority_assessments');
    }
};

